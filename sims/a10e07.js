/* sims/a10e07-v1.0.0.js  (published as sims/a10e07.js)
   Case a10e07 "A Choir in Many Rooms": a split planner for the Ardvane Aerostructures assistant on the
   night of Monday 28 to Tuesday 29 September 2026, the first night the model ran on two lent 2-card
   machines. No real model runs here and no text is written: every figure is worked out from the given
   numbers below (also stated in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: placement (one 4-card machine, or two 2-card machines),
     split (each layer split four ways; each layer split two ways inside a machine with each machine
     holding half the layers; each card holding a quarter of the layers), answer groups in flight (1 or
     2), provider (ours at $3.99 a card hour, or another at $4.29, which offers only a 4-card machine),
     play the night, play a reply, reset. Stats: the reading time, one stage, ms a token for each answer,
     tokens a second for each answer, tokens a second in all, swaps and hand-overs a token and where they
     travel, the share of card time spent waiting, the 800-token check, card time per check, the monthly
     bill and the extra over our provider. selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 70B: 70.6 billion weights, 80 layers, 2 bytes each in 16 bits: 141.2 billion bytes,
     about 132 GB on the card's meter (131.5 in 1,024-units). Too big for one 80 GB card.
   - NVIDIA H100: memory road 3.35 TB/s = 3,350 GB/s (the maker's 1,000); the fast link inside a machine
     (NVLink) 900 GB/s. Every split here gives each card a quarter of the weights: 141.2 / 4 = 35.3
     billion bytes, 35.3 / 3,350 = 10.5 ms in theory a token; 12 ms measured (the factory's own).
   - the factory's own measurements, never a source's: reading a card's quarter takes 12 ms a step,
     with one group of answers in the step or two; a swap of partial results takes 0.02 ms inside a
     machine and 0.2 ms across the provider's 25 Gb/s network, with one group or two (nearly all of it is
     the trip, not the load); a hand-over between machines also takes 0.2 ms, and inside one 0.02 ms.
   - a split layer: each card does its share, then all cards swap partial results (send, wait, add),
     twice per layer (two all-reduces per layer, Megatron-LM). 80 layers x 2 = 160 swaps a token.
   - a split by layers: each stage (a machine or a card) runs its run of layers and hands one result to
     the next stage. The sim leaves out the chosen token's return trip to the first stage and the
     engine's own overheads, as the story does.
   - groups in flight: with each layer split four ways, a second group shares every step (each swap
     carries both groups' partial results). With a split by layers, the second group fills the stages
     the first has left: one answer's token takes max(the chain, groups x one stage).
   - waiting share: the share of paid card time a card is not reading its weights: 1 - groups x 12 ms /
     the token time (a second group in the same step adds no reading).
   - prices, close to one provider's list price on 16 October 2026 (Lambda, $3.99 to $4.29 a card hour
     by machine size): ours $3.99 a card hour, the other provider's 4-card machine $4.29. A month is
     730 hours. Our provider lent the two 2-card machines at the same $3.99.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e07-v1.0.0.json):
   - one 4-card machine, split four ways (since launch, Monday 2 March 2026): 12 + 160 x 0.02 = 15.2 ms
     a token, 1,000 / 15.2 = 65.8, 66 a second; 800 tokens x 15.2 ms = 12.16 s, 12.2 s; waiting
     1 - 12 / 15.2 = 21%.
   - two 2-card machines, split four ways (tonight): every swap needs all four cards, two in each
     machine, so all 160 cross the network: 12 + 160 x 0.2 = 44 ms, 22.7 a second (the dashboard's 23);
     800 x 44 ms = 35.2 s; waiting 32 / 44 = 73%. reading 800 x 12 ms = 9.6 s of the check; waiting on
     swaps 800 x 32 ms = 25.6 s (last week 800 x 3.2 ms = 2.56 s).
   - reply 0, two groups in each step, split four ways on two machines: still 44 ms a token for each
     answer, 22.7 a second each, 2 x 22.7 = 45.5 a second in all; the check 35.2 s; waiting 73%.
   - reply 1, the other provider's 4-card machine: 15.2 ms, 66 a second, 12.2 s; $4.29 x 4 x 730 =
     $12,526.80, $12,527 a month against $3.99 x 4 x 730 = $11,650.80, $11,651: 0.30 x 4 x 730 = $876.
   - reply 2, each card a quarter of the layers (20 each) on two machines: stages of 12 ms, hand-overs
     card 1 to 2 inside (0.02), 2 to 3 across (0.2), 3 to 4 inside (0.02): 48 + 0.24 = 48.24 ms, 48.2 ms,
     20.7 a second; 800 x 48.24 = 38.6 s; waiting 1 - 12 / 48.24 = 75% (one group), 50% with two.
     (the brief's 4 x 12 + 3 x 0.2 = 48.6 ms counted every hand-over as crossing; only one does.)
   - reply 3, each layer split two ways inside a machine, each machine half the layers (40): a stage is
     12 + 80 x 0.02 = 13.6 ms; a token 2 x 13.6 + 0.2 = 27.4 ms, 36.5 a second; 800 x 27.4 = 21.9 s;
     waiting 1 - 12 / 27.4 = 56% with one group; with two, max(27.4, 2 x 13.6) = 27.4 ms, 2 x 36.5 = 73
     a second in all, waiting 1 - 24 / 27.4 = 12%.
   - card time per check: 4 x $3.99 = $15.96 an hour; 35.2 s x 15.96 / 3,600 = $0.16 tonight, 12.16 s:
     $0.05 last week.
   - the cold case, our 4-card machine back from Monday 19 October with the 2 x 2 settings kept: the
     hand-over is inside the machine: 2 x 13.6 + 0.02 = 27.22 ms, 27.2 ms, 36.7 a second, 800 x 27.22 =
     21.8 s; with two groups max(27.22, 27.2) = 27.22 ms, waiting 1 - 24 / 27.22 = 12%. split four ways
     again: 15.2 ms, 12.2 s.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var BYTES_B = 141.2;         // billion bytes of weights in 16 bits
  var CARDS = 4;
  var LAYERS = 80;
  var ROAD = 3350;             // GB/s, H100
  var READ_MS = 12;            // measured reading time of a card's quarter, a step
  var INSIDE_MS = 0.02;        // a swap or hand-over inside a machine (measured)
  var ACROSS_MS = 0.2;         // a swap or hand-over across the 25 Gb/s network (measured)
  var CHECK_TOKENS = 800;
  var HOURS = 730;
  var PRICES = { ours: 3.99, other: 4.29 };

  var PLACES = [
    { value: "two", label: "two 2-card machines on the 25 Gb/s network (lent from 28 september)" },
    { value: "one", label: "one 4-card machine, fast link inside (ours until 28 september)" }
  ];
  var SPLITS = [
    { value: "t4", label: "every layer split four ways (the settings file)" },
    { value: "t2p2", label: "each layer split two ways inside a machine; each machine half the layers" },
    { value: "p4", label: "each card a quarter of the layers, no layer split" }
  ];
  var GROUPS = [
    { value: "1", label: "1 group of answers" },
    { value: "2", label: "2 groups of answers" }
  ];
  var PROVIDERS = [
    { value: "ours", label: "ours, $3.99 a card hour" },
    { value: "other", label: "another provider's 4-card machine, $4.29 a card hour" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: more answers in each step" },
    { value: "r1", label: "reply 1: another provider's 4-card machine" },
    { value: "r2", label: "reply 2: each card a quarter of the layers" },
    { value: "r3", label: "reply 3: split layers inside a machine, half the layers each" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function ms(x) { return (Math.round(x * 10) / 10) + " ms"; }
  function rate(x) { return (x >= 50 ? String(Math.round(x)) : x.toFixed(1)) + " tokens a second"; }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function money(x) { return "$" + fmt(Math.round(x)); }
  function defaults() {
    return { place: "two", split: "t4", groups: "1", provider: "ours", plan: "none" };
  }

  /* ---------- the planner (pure: settings in, figures out) ---------- */

  function plan(C) {
    var two = C.place === "two" && C.provider === "ours";
    var g = Number(C.groups);
    var hop = two ? ACROSS_MS : INSIDE_MS;
    var R = { two: two, g: g };
    if (C.split === "t4") {
      R.stage = null;
      R.swaps = 2 * LAYERS;
      R.swapsAcross = two ? R.swaps : 0;
      R.hand = 0; R.handAcross = 0;
      R.chain = READ_MS + R.swaps * hop;
      R.token = R.chain;                          // a second group shares the same step
      R.busy = READ_MS;
    } else if (C.split === "t2p2") {
      R.stage = READ_MS + LAYERS * INSIDE_MS;     // 40 layers x 2 swaps, always inside a machine
      R.swaps = 2 * LAYERS;
      R.swapsAcross = 0;
      R.hand = 1; R.handAcross = two ? 1 : 0;
      R.chain = 2 * R.stage + hop;
      R.token = Math.max(R.chain, g * R.stage);
      R.busy = g * READ_MS;
    } else {
      R.stage = READ_MS;
      R.swaps = 0; R.swapsAcross = 0;
      R.hand = 3; R.handAcross = two ? 1 : 0;    // cards 1-2 and 3-4 share a machine
      R.chain = CARDS * READ_MS + (two ? ACROSS_MS + 2 * INSIDE_MS : 3 * INSIDE_MS);
      R.token = Math.max(R.chain, g * R.stage);
      R.busy = g * READ_MS;
    }
    R.each = 1000 / R.token;
    R.all = g * R.each;
    R.wait = 1 - R.busy / R.token;
    R.check = CHECK_TOKENS * R.token / 1000;
    var price = PRICES[C.provider];
    R.hour = CARDS * price;
    R.month = R.hour * HOURS;
    R.extra = (price - PRICES.ours) * CARDS * HOURS;
    R.checkCost = R.check * R.hour / 3600;
    R.text = {
      read: ms(READ_MS) + " (" + (BYTES_B / CARDS).toFixed(1) + " billion bytes, " +
        (BYTES_B / CARDS / ROAD * 1000).toFixed(1) + " in theory)",
      stage: R.stage === null ? "none: all four cards work every layer" : ms(R.stage),
      token: ms(R.token),
      each: rate(R.each),
      all: rate(R.all),
      swaps: R.swaps + " swaps, " + R.swapsAcross + " across machines; " + R.hand +
        (R.hand === 1 ? " hand-over, " : " hand-overs, ") + R.handAcross + " across",
      wait: pct(R.wait),
      check: R.check.toFixed(1) + " s",
      cost: "$" + R.checkCost.toFixed(2) + " of card time",
      month: money(R.month) + " a month",
      extra: R.extra > 0 ? money(R.extra) + " a month" : "$0"
    };
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
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    var note = el("pre", "margin:0;white-space:pre-wrap;font-size:11px;", "", box);
    return { el: el, head: head, table: table, note: note };
  }
  function row(ui, cells, th, mark) {
    var tr = ui.el("tr", mark ? "font-weight:bold;" : "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;vertical-align:top;", String(c), tr); });
  }

  // one row per card: where it sits, what it holds, and what one token asks of it
  function cardRows(C, R) {
    var rows = [];
    for (var i = 0; i < CARDS; i++) {
      var where = R.two ? "machine " + (i < 2 ? 1 : 2) : "machine 1";
      var holds, does;
      if (C.split === "t4") {
        holds = "a quarter of all 80 layers";
        does = "reads 12 ms, swaps 160 times" + (R.two ? " over the network" : " inside");
      } else if (C.split === "t2p2") {
        holds = "half of layers " + (i < 2 ? "1 to 40" : "41 to 80");
        does = "reads 12 ms, swaps 80 times inside" + (i === 1 ? "; hands one result on" : "");
      } else {
        holds = "all of layers " + (i * 20 + 1) + " to " + (i * 20 + 20);
        does = "reads 12 ms" + (i < 3 ? "; hands one result on" + (R.two && i === 1 ? " over the network" : "") : "");
      }
      rows.push(["card " + (i + 1), where, holds, does]);
    }
    return rows;
  }

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    var R = plan(C);
    ui.head.textContent = (R.two ? "two 2-card machines" : "one 4-card machine") + ", " + pick(SPLITS, C.split).label +
      ", " + C.groups + (C.groups === "1" ? " group" : " groups") + ". a token: " + R.text.token + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["card", "where", "holds", "each token"], true);
    cardRows(C, R).forEach(function (r) { row(ui, r, false, false); });
    ui.note.textContent = "a swap: every card sends its partial result, waits for the others, and adds them up. " +
      "a hand-over: one stage sends its one result to the next. inside a machine either takes 0.02 ms; " +
      "across the network 0.2 ms (the factory's own measurements).";
  }

  function setStats(api) {
    var R = plan(api.state.C);
    var st = api.state.stat;
    ["read", "stage", "token", "each", "all", "swaps", "wait", "check", "cost", "month", "extra"].forEach(function (k) {
      st[k](R.text[k]);
    });
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = plan(api.state.C);
    if (what) api.log(what + " a token " + R.text.token + ", " + R.text.each + " each; the check " + R.text.check +
      "; cards waiting " + R.text.wait + ".", R.check > 20 ? "bad" : "ok");
  }

  function playNight(api) {
    var before = plan({ place: "one", split: "t4", groups: "1", provider: "ours" });
    var now = plan(defaults());
    api.log("22 sep 00:30  one 4-card machine: a token " + before.text.token + ", the check " + before.text.check + ".", "ok");
    api.log("28 sep 21:00  moved to two 2-card machines, the settings file still splits every layer four ways.", "warn");
    api.log("29 sep 00:30  the rivet-pattern check asks: 800 tokens, " + now.swaps + " swaps a token, all across the network.", "warn");
    api.log("29 sep 00:30:35  the check arrives after " + now.text.check + ": " + now.text.token + " a token, " + now.text.each +
      ", cards waiting " + now.text.wait + ".", "bad");
  }

  function planConfig(p) {
    var C = defaults();
    C.plan = p;
    if (p === "r0") C.groups = "2";
    if (p === "r1") { C.provider = "other"; C.place = "one"; }
    if (p === "r2") C.split = "p4";
    if (p === "r3") { C.split = "t2p2"; C.groups = "2"; }
    return C;
  }

  function planFollowUp(api, p) {
    var C = api.state.C;
    var R = plan(C);
    if (p === "r0") api.log("two groups in each step: every swap carries both and still crosses the network. " + R.text.token +
      " a token, " + R.text.each + " each, " + R.text.all + " in all; the check " + R.text.check + ".", "bad");
    if (p === "r1") api.log("another provider's 4-card machine: " + R.text.token + " a token, " + R.text.each + ", the check " +
      R.text.check + ". bill " + R.text.month + ", " + R.text.extra + " more than ours.", "warn");
    if (p === "r2") api.log("each card a quarter of the layers: no swaps, 3 hand-overs, 1 across. " + R.text.token + " a token, " +
      R.text.each + ", the check " + R.text.check + "; cards waiting " + R.text.wait + ".", "bad");
    if (p === "r3") api.log("split inside each machine, half the layers each: a stage " + R.text.stage + ", " + R.text.token +
      " a token, " + R.text.each + " each, " + R.text.all + " in all; the check " + R.text.check + "; cards waiting " +
      R.text.wait + ".", "ok");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["place", "split", "groups", "provider"];
      function syncControls() {
        S.sync = true;
        IDS.forEach(function (id) { S.ctl[id].set(S.C[id]); });
        S.sync = false;
      }
      function chooser(id, label, list) {
        S.ctl[id] = api.control.select(id, label, list, S.C[id], function (val) {
          if (S.sync) return;
          var o = pick(list, val);
          if (!o) return;
          S.C[id] = String(o.value);
          var what = label + ": " + o.label + ".";
          if (id === "provider" && S.C.provider === "other" && S.C.place !== "one") {
            S.C.place = "one";
            what += " (the other provider offers only a 4-card machine.)";
          }
          if (id === "place" && S.C.place === "two" && S.C.provider === "other") {
            S.C.provider = "ours";
            what += " (two 2-card machines come only from ours.)";
          }
          if (S.C.plan !== "none") {
            S.C.plan = "none";
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          syncControls();
          refresh(api, what);
        });
      }
      chooser("place", "placement", PLACES);
      chooser("split", "split", SPLITS);
      chooser("groups", "answer groups in flight", GROUPS);
      chooser("provider", "provider", PROVIDERS);
      S.ctl.night = api.control.button("night", "play 00:30 as it happened", function () {
        S.C = defaults();
        syncControls();
        S.sync = true; S.ctl.plan.set("none"); S.sync = false;
        draw(api);
        setStats(api);
        playNight(api);
      });
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
        read: api.stat("read", "each card reads its quarter", ""),
        stage: api.stat("stage", "one stage", ""),
        token: api.stat("token", "a token, each answer", "bad"),
        each: api.stat("each", "speed, each answer", "bad"),
        all: api.stat("all", "speed, all answers", ""),
        swaps: api.stat("swaps", "a token's swaps and hand-overs", "warn"),
        wait: api.stat("wait", "card time spent waiting", "warn"),
        check: api.stat("check", "800-token panel check", "bad"),
        cost: api.stat("cost", "card time per check", ""),
        month: api.stat("month", "card bill", ""),
        extra: api.stat("extra", "more than our provider", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one of the four cards: which machine it sits in, which part of the model it holds, and what one token asks of it. A swap needs every card that shares a layer, so if those cards sit in two machines, every swap crosses the network. A hand-over sends one result from one stage to the next. Waiting is the share of paid card time not spent reading weights.");

      draw(api);
      setStats(api);
      api.log("00:29:50 on tuesday 29 september: two lent 2-card machines since 21:00, every layer split four ways. nothing asked yet.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before the 00:30 check: tonight's placement in force.
      t.expect(t.stat("token") === "44 ms" && t.stat("each") === "22.7 tokens a second" && t.stat("check") === "35.2 s" &&
        t.stat("swaps") === "160 swaps, 160 across machines; 0 hand-overs, 0 across" && t.stat("wait") === "73%" &&
        has("00:29:50 on tuesday 29 september"),
        "Opens before 00:30 on two machines: 44 ms a token, 22.7 a second, 35.2 s a check, 160 swaps across, 73% waiting");

      // 2. Each card's share: 35.3 billion bytes, 10.5 ms in theory, 12 measured.
      t.expect(t.stat("read") === "12 ms (35.3 billion bytes, 10.5 in theory)" && t.stat("month") === "$11,651 a month" &&
        t.stat("cost") === "$0.16 of card time" && t.stat("extra") === "$0",
        "Each card reads 35.3 billion bytes: 10.5 ms in theory, 12 measured; $11,651 a month; $0.16 a check");

      // 3. 00:30 as it happened.
      t.click("night");
      t.expect(has("22 sep 00:30  one 4-card machine: a token 15.2 ms, the check 12.2 s.") &&
        has("29 sep 00:30:35  the check arrives after 35.2 s: 44 ms a token, 22.7 tokens a second, cards waiting 73%."),
        "The night: 15.2 ms and 12.2 s last week; 44 ms and 35.2 s tonight");

      // 4. One 4-card machine, split four ways: the old speed.
      t.set("place", "one");
      t.expect(t.stat("token") === "15.2 ms" && t.stat("each") === "66 tokens a second" && t.stat("check") === "12.2 s" &&
        t.stat("wait") === "21%" && t.stat("cost") === "$0.05 of card time" &&
        t.stat("swaps") === "160 swaps, 0 across machines; 0 hand-overs, 0 across",
        "One machine: 15.2 ms, 66 a second, 12.2 s, 21% waiting, every swap inside");

      // 5. Reply 0: two groups in each step, still 44 ms for each answer.
      t.set("plan", "r0");
      t.expect(t.stat("token") === "44 ms" && t.stat("each") === "22.7 tokens a second" && t.stat("all") === "45.5 tokens a second" &&
        t.stat("check") === "35.2 s" && has("every swap carries both and still crosses the network."),
        "Reply 0: 45.5 a second in all, but each answer still 44 ms a token and the check 35.2 s");

      // 6. Reply 1: another provider's 4-card machine.
      t.set("plan", "r1");
      t.expect(t.stat("token") === "15.2 ms" && t.stat("month") === "$12,527 a month" && t.stat("extra") === "$876 a month" &&
        has("bill $12,527 a month, $876 a month more than ours."),
        "Reply 1: 15.2 ms again, $12,527 a month, $876 more");

      // 7. Reply 2: each card a quarter of the layers.
      t.set("plan", "r2");
      t.expect(t.stat("token") === "48.2 ms" && t.stat("each") === "20.7 tokens a second" && t.stat("check") === "38.6 s" &&
        t.stat("wait") === "75%" && t.stat("swaps") === "0 swaps, 0 across machines; 3 hand-overs, 1 across",
        "Reply 2: no swaps, 48.2 ms, 20.7 a second, 38.6 s, 75% waiting");

      // 8. Reply 3: split inside each machine, half the layers each, two groups.
      t.set("plan", "r3");
      t.expect(t.stat("stage") === "13.6 ms" && t.stat("token") === "27.4 ms" && t.stat("each") === "36.5 tokens a second" &&
        t.stat("all") === "73 tokens a second" && t.stat("check") === "21.9 s" && t.stat("wait") === "12%" &&
        t.stat("swaps") === "160 swaps, 0 across machines; 1 hand-over, 1 across",
        "Reply 3: 13.6 ms a stage, 27.4 ms a token, 36.5 a second, 21.9 s, 12% waiting");

      // 9. Reply 3 with one group: the bubble.
      t.set("groups", "1");
      t.expect(t.stat("token") === "27.4 ms" && t.stat("wait") === "56%" && t.stat("all") === "36.5 tokens a second",
        "One group on the 2 x 2 split: each machine waits 56% of the time");

      // 10. The other provider forces one machine.
      t.set("provider", "other");
      t.expect(t.stat("month") === "$12,527 a month" && has("(the other provider offers only a 4-card machine.)"),
        "Another provider: only a 4-card machine, $12,527 a month");

      // 11. The cold case: our machine back, the 2 x 2 settings kept.
      t.set("provider", "ours");
      t.set("place", "one");
      t.set("groups", "2");
      t.expect(t.stat("token") === "27.2 ms" && t.stat("each") === "36.7 tokens a second" && t.stat("check") === "21.8 s" &&
        t.stat("wait") === "12%",
        "Cold case: 2 x 2 on one machine, 27.2 ms, 36.7 a second, 21.8 s");

      // 12. Split four ways again on the one machine.
      t.set("split", "t4");
      t.expect(t.stat("token") === "15.2 ms" && t.stat("check") === "12.2 s" && t.stat("all") === "132 tokens a second",
        "Back to four ways inside one machine: 15.2 ms, 12.2 s, 132 a second for two groups");
    }
  });
})();
