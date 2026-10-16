/* sims/a10e09-v1.0.0.js  (published as sims/a10e09.js)
   Case a10e09 "The Relay": a router replay for the assistant at a wind-farm operator with three farms,
   on the night of Friday 9 to Saturday 10 October 2026, when IT pooled the three farm cards and a spare
   behind a balancer that takes turns. No real model runs here and no text is generated: every figure is
   worked out from the given numbers below (also stated in sim.lede), as an average over a night hour.
   Widget-style sim: it draws its own table of cards in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: routing (a card per farm, taking turns, manual-aware with
     overflow to the least-loaded card), cards (4, 5), manual length (50,000 or 20,000 tokens), separate
     reading cards (off, on), link (10 Gb/s network, 25 GB/s), a changing line before the manual (none,
     before: the cold case), play friday night, play a reply, reset. Stats: hit rate, first token
     (average), against last week, re-reads an hour, frozen writing an hour, hand-over per new reading,
     reading a manual, a manual's reading on the meter, room per card. selfTest: 12 assertions.
     One change from the brief's draft: manual-aware routing places manuals with a table (a new manual
     goes to the card holding the fewest), not the ring from s3e08: a 32-bit hash ring with 1 to 300
     places per card gave no 3-each layout for these 12 manuals (32 places gave 3, 4, 3 and 2).

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 8B: 8.03 billion weights, 16.06 billion bytes in 16 bits, about 15 GB on the card's meter
     (1 GB = 1,024 MB). Working memory 128 KB (131,072 bytes) per token (a10e03). A100 80GB: 312 TFLOPS,
     16-bit, dense.
   - 3 farms x 4 turbine models = 12 manuals of about 50,000 tokens. The prompt is the manual first, then
     a question of about 500 tokens. At night the crews ask 48 questions an hour, 4 per manual, 16 per farm.
   - Each card has room for 200,000 tokens of kept readings after the weights and the answers being
     written: 200,000 x 131,072 = 26,214,400,000 bytes = 24.4 GB on the meter, 4 whole manuals.
   - Skeldaig's own measurements, never a source's: reading a manual 9 s; a hit starts writing in 0.1 s;
     the most answers on any card at once on the night, 2 (busy means 8, so nothing overflows).
   - The set-up reads a whole prompt before its next writing step, so a reading freezes the answers on
     its card for the reading's length. With separate reading cards the writing cards never freeze, and
     each new reading is handed over: 25 GB/s, or the 10 Gb/s network = 1.25 GB/s.
   - The dashboard's hit rate counts prompt tokens already read: a hit reuses L of L + 500.

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e09-v1.0.0.json):
   - a manual's reading: 50,000 x 131,072 = 6,553,600,000 bytes: 6.10 GB on the meter, "6.1 GB";
     6.55 GB in the maker's units. 4 of them 24.4 GB. At 20,000 tokens: 2,621,440,000 bytes, 2.44 GB,
     room for 200,000 / 20,000 = 10.
   - sums to read L tokens: 2 x 8.03e9 x L (the weights) + 2 x 32 x 4,096 x L^2 (attention). L = 50,000:
     803 + 655.36 = 1,458.36 trillion, about 1.46 quadrillion; / 156 TFLOPS (half of 312) = 9.35 s by
     the sheet, about 9 s; Skeldaig's timing 9 s. L = 20,000: 426.06 trillion; 9 x 426.06 / 1,458.36 =
     2.63, "2.6 s".
   - the chance the card a question reaches holds its manual: a card that sees k manuals with room for r
     holds the asked one min(1, r / k) of the time (the r used most recently; questions spread evenly).
     a card per farm: k = 4, r = 4: 1. taking turns, any number of cards: k = 12, r = 4: 1/3. manual-
     aware: 4 cards k = 3 each; 5 cards 3, 3, 2, 2, 2: 1.
   - hit rate = chance x L / (L + 500): 50,000 / 50,500 = 99.0%, "99%"; / 3 = 33.0%, "33%"; 20,000
     taking turns: 10/12 x 20,000 / 20,500 = 81.3%, "81%". A changing line before the manual: 0%.
   - first token, average = (1 - chance) x (reading + hand-over) + chance x 0.1 s:
     a card per farm 0.1 s, 1x last week; taking turns (2/3 x 9) + (1/3 x 0.1) = 6.033, "6.0 s", 60x;
     5 cards the same; 20,000 tokens (2/12 x 2.63) + (10/12 x 0.1) = 0.522, "0.5 s"; separate reading
     cards, taking turns: 25 GB/s 6,553,600,000 / 25e9 = 0.262 s, 2/3 x 9.262 + 0.033 = 6.208, "6.2 s";
     10 Gb/s 6,553,600,000 / 1.25e9 = 5.243 s, 2/3 x 14.243 + 0.033 = 9.529, "9.5 s"; manual-aware 0.1 s;
     cold case 9.0 s.
   - re-reads an hour = 48 x (1 - chance): 0, 32, 8 (20,000 tokens), 48 (cold case).
   - frozen writing an hour = re-reads x reading (0 with separate reading cards): 288 s, 21 s, 432 s.
   - questions an hour per card: a card per farm 16; taking turns 48 / 4 = 12, 48 / 5 = 9.6; manual-
     aware 3 manuals x 4 = 12.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var FARMS = ["quharry", "skarvoe", "cnocbreac"];
  var MANUALS = [];
  FARMS.forEach(function (f) { for (var m = 1; m <= 4; m++) MANUALS.push(f + " " + m); });
  var PER_HOUR = 48;          // questions an hour at night, 4 per manual
  var HIT_S = 0.1;            // a hit starts writing in 0.1 s (Skeldaig's timing)
  var READ_FULL = 9;          // reading a 50,000-token manual (Skeldaig's timing)
  var FULL = 50000;           // tokens in a whole manual
  var QUESTION = 500;         // tokens in a question
  var ROOM = 200000;          // tokens of kept readings per card: 24.4 GB
  var KV = 131072;            // bytes of working memory per token
  var GIB = 1073741824;
  var LINKS = { "10": 1.25e9, "25": 25e9 };

  var ROUTES = [
    { value: "farm", label: "a card per farm (last week)" },
    { value: "turns", label: "taking turns (since 16:00)" },
    { value: "aware", label: "manual-aware: the card holding it, unless busy" }
  ];
  var CARDS = [{ value: "4", label: "4 cards" }, { value: "5", label: "5 cards" }];
  var LENGTHS = [
    { value: "50000", label: "whole manuals, 50,000 tokens" },
    { value: "20000", label: "cut to the first 20,000 tokens" }
  ];
  var SPLITS = [
    { value: "off", label: "off: every card reads and writes" },
    { value: "on", label: "on: the last card only reads" }
  ];
  var LINKSEL = [
    { value: "10", label: "the 10 Gb/s network (1.25 GB/s)" },
    { value: "25", label: "a 25 GB/s link" }
  ];
  var LINES = [
    { value: "none", label: "none: the manual comes first" },
    { value: "before", label: "a changing line before the manual" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: a fifth card in the turns" },
    { value: "r1", label: "reply 1: reading cards hand over to writing cards" },
    { value: "r2", label: "reply 2: the card already holding the manual" },
    { value: "r3", label: "reply 3: cut each manual to 20,000 tokens" }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function defaults() {
    return { route: "farm", cards: "4", length: "50000", split: "off", link: "10", line: "none", plan: "none" };
  }
  function num(x) { return Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toFixed(1); }
  function gb(bytes) { var g = bytes / GIB; return (g >= 5 ? g.toFixed(1) : g.toFixed(2)) + " GB"; }
  function sums(L) { return 2 * 8.03e9 * L + 2 * 32 * 4096 * L * L; }

  /* ---------- the routing arithmetic (pure: settings in, figures out) ---------- */

  // Which manuals each writing card sees. Manuals are first asked in list order, so with a table
  // a new manual goes to the card holding the fewest, ties to the lowest number: card i % m.
  function layout(C) {
    var n = Number(C.cards), m = C.split === "on" ? n - 1 : n, cards = [];
    for (var i = 0; i < n; i++) cards.push({ name: "card " + (i + 1), sees: [], reads: C.split === "on" && i === n - 1 });
    if (C.route === "farm") {
      for (var f = 0; f < 3; f++) cards[f].sees = MANUALS.slice(f * 4, f * 4 + 4);
    } else if (C.route === "turns") {
      for (var t = 0; t < m; t++) cards[t].sees = MANUALS.slice();
    } else {
      MANUALS.forEach(function (man, k) { cards[k % m].sees.push(man); });
    }
    return { cards: cards, m: m };
  }

  function figures(C) {
    var L = Number(C.length), slots = Math.floor(ROOM / L);
    var read = READ_FULL * sums(L) / sums(FULL);
    var bytes = L * KV;
    var hand = C.split === "on" ? bytes / LINKS[C.link] : 0;
    var lay = layout(C), held = 0;
    lay.cards.forEach(function (c) {
      var k = c.sees.length;
      c.chance = k ? Math.min(1, slots / k) : 0;
      c.perHour = !k ? 0 : C.route === "turns" ? PER_HOUR / lay.m : k * (PER_HOUR / MANUALS.length);
      held += c.perHour * c.chance; // questions an hour that find their reading
    });
    var h = C.line === "before" ? 0 : held / PER_HOUR;
    var R = { L: L, slots: slots, read: read, bytes: bytes, hand: hand, h: h, cards: lay.cards };
    R.tokHit = h * L / (L + QUESTION);
    R.avg = (1 - h) * (read + hand) + h * HIT_S;
    R.rereads = PER_HOUR * (1 - h);
    R.stall = C.split === "on" ? 0 : R.rereads * read;
    R.text = {
      hit: Math.round(R.tokHit * 100) + "%",
      first: R.avg.toFixed(1) + " s",
      times: Math.round(R.avg / HIT_S) + "×",
      rereads: Math.round(R.rereads) + " an hour",
      stall: Math.round(R.stall) + " s an hour",
      hand: C.split === "on" ? (hand < 1 ? hand.toFixed(2) : hand.toFixed(1)) + " s" : "none",
      read: num(read) + " s",
      size: gb(bytes),
      room: slots + " manuals, " + gb(ROOM * KV)
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

  function describe(c, slots) {
    if (c.reads) return "reads only; hands each reading over";
    if (!c.sees.length) return "idle";
    if (c.sees.length === MANUALS.length) return "all 12";
    return c.sees.join(", ");
  }

  function draw(api) {
    var C = api.state.C, ui = api.state.ui, R = figures(C);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    var how = pick(ROUTES, C.route).label;
    ui.head.textContent = "routing: " + how + ". " + C.cards + " cards" + (C.split === "on" ? ", the last one reading only" : "") +
      ". each card keeps the " + R.slots + " readings used most recently.";
    row(ui, ["card", "manuals it sees", "holds the asked one", "questions an hour"], true);
    R.cards.forEach(function (c) {
      var k = c.sees.length;
      row(ui, [c.name, describe(c, R.slots), c.reads || !k ? "" : Math.min(k, R.slots) + " of " + k,
        c.reads || !k ? "" : num(c.perHour)], false);
    });
    ui.note.textContent = "first token = misses " + num((1 - R.h) * 12) + " in 12 x (" + R.text.read + " reading" +
      (C.split === "on" ? " + " + R.text.hand + " hand-over" : "") + ") + hits " + num(R.h * 12) + " in 12 x 0.1 s = " +
      R.text.first + ". hit rate " + R.text.hit + ". re-reads " + R.text.rereads + ", frozen writing " + R.text.stall +
      (C.line === "before" ? ". a changing line sits before the manual, so no prompt begins like an earlier one." : ".");
  }

  function setStats(api) {
    var R = figures(api.state.C), st = api.state.stat;
    st.hit(R.text.hit);
    st.first(R.text.first);
    st.times(R.text.times);
    st.rereads(R.text.rereads);
    st.stall(R.text.stall);
    st.hand(R.text.hand);
    st.read(R.text.read);
    st.size(R.text.size);
    st.room(R.text.room);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = figures(api.state.C);
    if (what) api.log(what + " hit rate " + R.text.hit + ", first token " + R.text.first + ".", R.h < 0.9 ? "bad" : "ok");
  }

  function at(over) {
    var C = defaults();
    for (var k in over) C[k] = over[k];
    return figures(C);
  }

  function playNight(api) {
    var week = at({}), night = at({ route: "turns" });
    api.log("16:00  it pools the three farm cards and the spare behind a balancer that takes turns.", "");
    api.log("01:14:58  card 3 holds no reading of the cnocbreac manual it is asked about; it reads for " +
      night.text.read + " and every answer it is writing waits.", "bad");
    api.log("01:15  bergthora radios from a skarvoe nacelle: an answer froze for 9 seconds.", "warn");
    api.log("01:15:07  card 3 finishes reading; bergthora's answer starts again.", "");
    api.log("01:20  dashboard, last hour: hit rate " + night.text.hit + ", first token " + night.text.first +
      "; last week: " + week.text.hit + ", " + week.text.first + ".", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    C.route = "turns";
    if (plan === "r0") C.cards = "5";
    if (plan === "r1") C.split = "on";
    if (plan === "r2") C.route = "aware";
    if (plan === "r3") C.length = "20000";
    return C;
  }

  function planFollowUp(api, plan) {
    var R;
    if (plan === "r0") {
      R = at({ route: "turns", cards: "5" });
      api.log("a fifth card in the turns: each card gets " + num(R.cards[0].perHour) + " questions an hour but still sees all 12 manuals and keeps " +
        R.slots + ". hit rate " + R.text.hit + ", first token " + R.text.first + ", re-reads " + R.text.rereads +
        ", frozen writing " + R.text.stall + ".", "bad");
    }
    if (plan === "r1") {
      R = at({ route: "turns", split: "on", link: "10" });
      var fast = at({ route: "turns", split: "on", link: "25" });
      api.log("card 4 reads, cards 1 to 3 write, still taking turns: no frozen writing. over the 10 Gb/s network each hand-over takes " +
        R.text.hand + ": first token " + R.text.first + ". a 25 GB/s link: " + fast.text.hand + ", " + fast.text.first + ".", "warn");
    }
    if (plan === "r2") {
      R = at({ route: "aware" });
      api.log("each question to the card holding its manual, unless that card is busy: " + R.cards[0].sees.length +
        " manuals a card, " + num(R.cards[0].perHour) + " questions an hour each. hit rate " + R.text.hit + ", first token " +
        R.text.first + ", re-reads " + R.text.rereads + ", no frozen writing.", "ok");
    }
    if (plan === "r3") {
      R = at({ route: "turns", length: "20000" });
      api.log("manuals cut to 20,000 tokens: a reading takes " + R.text.read + " and " + R.text.size + ", room for " + R.slots +
        ". taking turns: hit rate " + R.text.hit + ", first token " + R.text.first + ". the back 30,000 tokens of every manual are gone.", "bad");
    }
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e09", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["route", "cards", "length", "split", "link", "line"];
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
          if (S.C.plan !== "none") {
            S.C.plan = "none";
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          refresh(api, what);
        });
      }
      chooser("route", "routing", ROUTES);
      chooser("cards", "cards", CARDS);
      chooser("length", "manual length", LENGTHS);
      chooser("split", "separate reading cards", SPLITS);
      chooser("link", "hand-over link", LINKSEL);
      chooser("line", "a line before the manual", LINES);
      S.ctl.night = api.control.button("night", "play friday night", function () {
        S.C = defaults();
        S.C.route = "turns";
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
        hit: api.stat("hit", "hit rate", "warn"),
        first: api.stat("first", "first token, average", "bad"),
        times: api.stat("times", "against last week's 0.1 s", ""),
        rereads: api.stat("rereads", "re-reads", ""),
        stall: api.stat("stall", "frozen writing", "bad"),
        hand: api.stat("hand", "hand-over per new reading", ""),
        read: api.stat("read", "reading a manual", ""),
        size: api.stat("size", "a manual's reading, on the meter", ""),
        room: api.stat("room", "room per card", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one card. It keeps the readings it used most recently, as many as its room holds. If it sees more manuals than that, the card a question reaches holds the asked manual only some of the time; the rest of the time it reads the manual first, and every answer it is writing waits. The note works out the average first token from those shares.");

      draw(api);
      setStats(api);
      api.log("15:59 on friday 9 october: one card per farm. last week: hit rate 99%, first token 0.1 s.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: last week's set-up, a minute before the pooling.
      t.expect(t.stat("hit") === "99%" && t.stat("first") === "0.1 s" && t.stat("times") === "1×" &&
        t.stat("rereads") === "0 an hour" && t.stat("stall") === "0 s an hour" && t.stat("read") === "9 s" &&
        has("15:59 on friday 9 october"),
        "Opens on one card per farm: 99%, 0.1 s, no re-reads");

      // 2. Friday night as it happened.
      t.click("night");
      t.expect(has("01:20  dashboard, last hour: hit rate 33%, first token 6.0 s; last week: 99%, 0.1 s.") &&
        has("01:15:07  card 3 finishes reading") && t.stat("hit") === "33%" && t.stat("first") === "6.0 s" &&
        t.stat("times") === "60×" && t.stat("rereads") === "32 an hour" && t.stat("stall") === "288 s an hour",
        "Taking turns: 33%, 6.0 s, 60 times last week, 32 re-reads and 288 s of frozen writing an hour");

      // 3. A fifth card in the turns.
      t.set("cards", "5");
      t.expect(t.stat("hit") === "33%" && t.stat("first") === "6.0 s" && t.stat("rereads") === "32 an hour",
        "Five cards taking turns: still 33% and 6.0 s");

      // 4. Separate reading cards over the 10 Gb/s network.
      t.set("split", "on");
      t.expect(t.stat("hand") === "5.2 s" && t.stat("first") === "9.5 s" && t.stat("stall") === "0 s an hour",
        "Reading cards over 10 Gb/s: 5.2 s hand-overs, 9.5 s average, no frozen writing");

      // 5. A 25 GB/s link.
      t.set("link", "25");
      t.expect(t.stat("hand") === "0.26 s" && t.stat("first") === "6.2 s",
        "Reading cards over 25 GB/s: 0.26 s hand-overs, 6.2 s average");

      // 6. Manuals cut to 20,000 tokens.
      t.set("split", "off");
      t.set("length", "20000");
      t.expect(t.stat("hit") === "81%" && t.stat("first") === "0.5 s" && t.stat("read") === "2.6 s" &&
        t.stat("size") === "2.44 GB" && t.stat("room") === "10 manuals, 24.4 GB" && t.stat("stall") === "21 s an hour",
        "20,000-token manuals: room for 10, 81%, 0.5 s, 2.6 s readings");

      // 7. Manual-aware routing on four cards.
      t.set("length", "50000");
      t.set("cards", "4");
      t.set("route", "aware");
      t.expect(t.stat("hit") === "99%" && t.stat("first") === "0.1 s" && t.stat("rereads") === "0 an hour" &&
        t.stat("size") === "6.1 GB" && t.stat("room") === "4 manuals, 24.4 GB",
        "Manual-aware routing: 99%, 0.1 s; a manual 6.1 GB, room for 4 in 24.4 GB");

      // 8. Reply 0 as played.
      t.set("plan", "r0");
      t.expect(has("a fifth card in the turns: each card gets 9.6 questions an hour but still sees all 12 manuals and keeps 4. hit rate 33%, first token 6.0 s, re-reads 32 an hour, frozen writing 288 s an hour."),
        "Reply 0: 9.6 questions a card, still 33% and 6.0 s");

      // 9. Reply 1 as played.
      t.set("plan", "r1");
      t.expect(has("over the 10 Gb/s network each hand-over takes 5.2 s: first token 9.5 s. a 25 GB/s link: 0.26 s, 6.2 s."),
        "Reply 1: no freezes; 9.5 s over the network, 6.2 s over a 25 GB/s link");

      // 10. Reply 2 as played.
      t.set("plan", "r2");
      t.expect(has("each question to the card holding its manual, unless that card is busy: 3 manuals a card, 12 questions an hour each. hit rate 99%, first token 0.1 s, re-reads 0 an hour, no frozen writing.") &&
        t.stat("hit") === "99%",
        "Reply 2: 3 manuals a card, 12 questions an hour each, 99%, 0.1 s");

      // 11. Reply 3 as played.
      t.set("plan", "r3");
      t.expect(has("manuals cut to 20,000 tokens: a reading takes 2.6 s and 2.44 GB, room for 10. taking turns: hit rate 81%, first token 0.5 s."),
        "Reply 3: 81% and 0.5 s, with the back of every manual gone");

      // 12. The cold case: a changing line before the manual, with manual-aware routing.
      t.set("plan", "r2");
      t.set("line", "before");
      t.expect(t.stat("hit") === "0%" && t.stat("first") === "9.0 s" && t.stat("rereads") === "48 an hour" &&
        t.stat("stall") === "432 s an hour",
        "Cold case: a changing line first, 0%, 9.0 s, every question re-reads");
    }
  });
})();
