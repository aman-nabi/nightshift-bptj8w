/* sims/a10e05-v1.0.0.js  (published as sims/a10e05.js)
   Case a10e05 "The Miniature Village": a precision scoreboard for the Eskmere concrete plant's paperwork
   assistant on the night of Thursday 17 September 2026. No real model runs here and no ticket text is
   written by a model in this file: every figure is worked out from the given numbers below (also stated
   in sim.lede). Widget-style sim: it draws its own table in api.root.

   CHANGELOG
   v1.0.0 (2026-10-16) first version. Controls: how each weight is stored (16-bit, FP8, 4-bit), sets
     scored (English only, English and numbers), cards (1 or 2), chats at the night peak (6 or 24),
     play the night, play a reply, reset. Stats: weights' memory, whether it fits, room for chats, chats
     held, chats waiting, English score, numbers score, loss against 16-bit, the sign-off's verdict,
     wrong tickets expected in a night of 22, monthly card bill, fastest writing, ticket 502.
     selfTest: 12 assertions.

   The given data (the season bible's shared data and the case's own, stated in sim.lede):
   - Llama 3.1 70B: 70.6 billion weights, 80 layers, 8 key/value heads of 128 numbers.
     16-bit: 141.2 billion bytes = 131.5 GB on the meter, "about 132 GB". FP8: 70.6 billion bytes =
     65.8 GB, "about 66 GB". 4-bit (AWQ): 35.3 billion bytes = 32.9 GB, "about 33 GB", plus one 16-bit
     scale per group of 128 weights: 70.6 / 128 x 2 = 1.1 billion bytes = 1.03 GB, "about 1 GB";
     34 GB in all. Sizes in the meter's units (1 GB = 1,024 MB = 1,048,576 KB).
   - working memory per token: 2 x 80 x 8 x 128 x 2 bytes = 327,680 bytes = 320 KB (case a10e03).
   - NVIDIA H100 80GB: 80 GB, 4 GB of working space per card, 3.35 TB/s (speeds in the maker's units,
     1 TB = 1,000 GB).
   - price $3.99 a card hour (one provider's dollar list price, read 16 October 2026), 730 hours a
     month: one card $2,912.70, "$2,913"; two $5,825.40, "$5,825"; the gap $5,825 - $2,913 = $2,912.
   - the plant's own measurements, never a source's: the English set (200 procedure questions):
     16-bit 188, FP8 188, 4-bit 186. The numbers set (160 past tickets with checked figures, built by
     the office in April): 16-bit 154 (April), FP8 153, 4-bit 136 (the scores as Eyvind measures them
     from Friday 18 September; nobody had run the numbers set on the 4-bit copy before the night).
     The sim's table opens with every copy as the week will score it, as a10e03 opened on 22:10. With reply 1's 200 extra English questions, scored like the first 200: 376 and 372 of
     400. With reply 3's self-check, measured after its first week: 139 of 160 (the second try agreed
     with the first on 21 of the 24 wrong totals).
   - the night peak: 6 chats at once (Thursday); the cold case's winter peak, 24. A chat is counted at
     1,600 tokens.
   - the sign-off rule: a copy passes a set when it loses no more than 1% of that set against 16-bit
     (2 of 200, 1 of 160).
   - Thursday's tickets (22 between 18:00 and 23:40, numbers 481 to 502): three wrong. 484 at 19:05,
     12 m³ x £106 printed £1,212.00 (by hand £1,272.00); 493 at 21:30, 6 m³ x £98 printed £558.00
     (by hand £588.00); 502 at 23:40, 38 m³ x £115 printed £437.00 (by hand £4,370.00, £11.50 a m³
     printed).

   Where every number comes from (conventions rule 14; the case is content/latent/a10/a10e05-v1.0.0.json).
   - room for chats = 80 x cards - weights - 4 x cards GB. FP8 on one card: 80 - 66 - 4 = 10 GB =
     10,485,760 KB / 320 = 32,768 tokens / 1,600 = 20 chats. 16-bit on two: 160 - 132 - 8 = 20 GB,
     65,536 tokens, 40 chats. 4-bit on one: 80 - 34 - 4 = 42 GB, 137,625 tokens, 86 chats. FP8 on two:
     86 GB, 281,804 tokens, 176 chats. 16-bit on one: 132 + 4 > 80, does not fit.
   - wrong tickets expected in a night of 22 = (160 - numbers score) / 160 x 22: 16-bit 6 -> 0.8,
     FP8 7 -> 1.0 (0.96), 4-bit 24 -> 3.3 (Thursday: 3 of 22), self-check 21 -> 2.9.
   - ticket 502 short by £4,370.00 - £437.00 = £3,933.00 (the plant manager's comment); 16-bit's
     6 slips in 160 are about 1 ticket in 27 (160 / 6 = 26.7); 16 bits hold 2^16 = 65,536 values,
     4 bits 2^4 = 16 (the post's squeezing paragraph).
   - loss against 16-bit: English 188 - 186 = 2 of 200, 1%; numbers 154 - 136 = 18 of 160, 11%
     (11.25). FP8: 0 of 200, 1 of 160 (0.6%).
   - fastest writing (each token reads every weight once, a10e01): bytes per card / 3.35 TB/s.
     16-bit on two cards: 70.6 billion bytes a card, 21 ms, about 47 a second (the cards' swaps,
     a later case, come on top); FP8 on one: the same 47; 4-bit on one: 36.4 billion bytes, 10.9 ms,
     about 92.
   - the cold case: 24 chats at the peak; FP8 on one card holds 20, 4 wait; FP8 on two holds 176,
     $5,825; 4-bit on one holds 86 at 136 of 160.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var WEIGHTS = 70.6e9;
  var KB_PER_TOKEN = 2 * 80 * 8 * 128 * 2 / 1024;     // 320
  var KB_PER_GB = 1024 * 1024;
  var CARD_GB = 80;
  var WORK_GB = 4;                                    // working space per card
  var ROAD = 3.35e12;                                 // bytes a second per card
  var PRICE = 3.99;                                   // a card hour
  var HOURS = 730;
  var CHAT_TOKENS = 1600;
  var TICKETS = 22;
  var COPIES = {
    "16": { name: "16-bit (FP16)", gb: 132, mem: "about 132 GB", bytes: WEIGHTS * 2, eng: 188, num: 154 },
    "fp8": { name: "FP8 (8-bit floating point)", gb: 66, mem: "about 66 GB", bytes: WEIGHTS, eng: 188, num: 153 },
    "4": { name: "4-bit (INT4, AWQ)", gb: 34, mem: "about 34 GB (33 + 1 of scales)", bytes: WEIGHTS * 0.5 + WEIGHTS / 128 * 2, eng: 186, num: 136 }
  };
  var PRECS = [
    { value: "16", label: "16-bit, as since March" },
    { value: "fp8", label: "FP8, 8-bit floating point" },
    { value: "4", label: "4-bit, as from 18:00 Thursday" }
  ];
  var SETS = [
    { value: "eng", label: "the English set only (the sign-off)" },
    { value: "both", label: "English and numbers" }
  ];
  var CARDS = [
    { value: "1", label: "1 card" },
    { value: "2", label: "2 cards" }
  ];
  var CHATS = [
    { value: "6", label: "6 (the night peak)" },
    { value: "24", label: "24 (two night crews)" }
  ];
  var PLANS = [
    { value: "none", label: "none: set the controls yourself" },
    { value: "r0", label: "reply 0: score every copy on every set" },
    { value: "r1", label: "reply 1: 200 more English questions" },
    { value: "r2", label: "reply 2: back to 16-bit on two cards" },
    { value: "r3", label: "reply 3: the 4-bit model checks its sums" }
  ];
  var NIGHT = [
    { n: 484, at: "19:05", vol: 12, mix: "", price: 106, printed: 1212 },
    { n: 493, at: "21:30", vol: 6, mix: "", price: 98, printed: 558 },
    { n: 502, at: "23:40", vol: 38, mix: "c32/40", price: 115, printed: 437 }
  ];

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(n) { return "£" + fmt(Math.floor(n)) + "." + ("0" + Math.round((n % 1) * 100)).slice(-2); }
  function monthly(cards) { return Math.round(PRICE * HOURS * cards); }
  function defaults() {
    return { prec: "4", sets: "eng", cards: "1", chats: "6", plan: "none", extra: false, check: false };
  }

  /* ---------- the scoreboard (pure: settings in, figures out) ---------- */

  function calc(C) {
    var cp = COPIES[C.prec];
    var cards = Number(C.cards);
    var wanted = Number(C.chats);
    var roomGB = CARD_GB * cards - cp.gb - WORK_GB * cards;
    var fits = roomGB > 0;
    var tokens = fits ? Math.floor(roomGB * KB_PER_GB / KB_PER_TOKEN) : 0;
    var room = Math.floor(tokens / CHAT_TOKENS);
    var held = Math.min(room, wanted);
    var engOf = C.extra ? 400 : 200;
    var eng = C.extra ? cp.eng * 2 : cp.eng;
    var eng16 = C.extra ? COPIES["16"].eng * 2 : COPIES["16"].eng;
    var num = C.check && C.prec === "4" ? 139 : cp.num;
    var ran = C.sets === "both" || C.prec === "16";
    var engLoss = eng16 - eng;
    var numLoss = COPIES["16"].num - num;
    var engPass = engLoss <= engOf / 100;
    var numPass = numLoss <= 1;
    var R = { cp: cp, fits: fits, roomGB: roomGB, tokens: tokens, room: room, held: held, wait: wanted - held,
      eng: eng, num: num, ran: ran, engLoss: engLoss, numLoss: numLoss };
    R.wrong = ((160 - num) / 160 * TICKETS).toFixed(1);
    var perCard = cp.bytes / cards;
    R.text = {
      mem: cp.mem,
      fits: !fits ? "no: " + cp.gb + " + " + (WORK_GB * cards) + " GB > " + (CARD_GB * cards) :
        (cards === 1 ? "yes: " + cp.gb + " + 4 of 80 GB" : "split over 2 cards: " + cp.gb + " + 8 of 160 GB"),
      room: fits ? roomGB + " GB: " + fmt(tokens) + " tokens, " + room + " chats" : "none",
      held: held + " of " + wanted,
      eng: eng + " of " + engOf,
      num: ran ? num + " of 160" + (C.prec === "16" && C.sets === "eng" ? " (april)" : "") : "not run",
      loss: C.prec === "16" ? "none: this is the 16-bit model" :
        "english " + engLoss + " of " + engOf + " (" + Math.round(engLoss / engOf * 100) + "%)" +
        (ran ? ", numbers " + numLoss + " of 160 (" + Math.round(numLoss / 160 * 100) + "%)" : ", numbers not run"),
      signoff: C.prec === "16" ? "not needed: the full model" :
        (!engPass ? "fail: english" : (!ran ? "pass: no loss on the english set" :
          (numPass ? "pass: within 1% on both sets" : "fail: numbers, " + numLoss + " more wrong of 160"))),
      wrong: ran ? R.wrong + " of 22" : "not measured: numbers set not run",
      cost: "$" + fmt(monthly(cards)) + " a month",
      speed: fits ? "about " + Math.round(ROAD / perCard) + " tokens a second" : "does not fit",
      ticket: "printed " + money(437) + ", by hand " + money(38 * 115)
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

  function draw(api) {
    var C = api.state.C;
    var ui = api.state.ui;
    ui.head.textContent = "the same 70.6 billion weights, stored three ways. cards: " + C.cards +
      "; chats at the peak: " + C.chats + "; sets scored: " + (C.sets === "both" ? "english and numbers" : "english only") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["copy", "weights", "room for chats", "english", "numbers", "wrong in 22", "bill"], true);
    PRECS.forEach(function (p) {
      var D = {};
      for (var k in C) D[k] = C[k];
      D.prec = p.value;
      var Q = calc(D);
      row(ui, [Q.cp.name, Q.text.mem, Q.text.room, Q.text.eng, Q.text.num, Q.ran ? Q.wrong : "?", Q.text.cost],
        false, p.value === C.prec);
    });
    ui.note.textContent = "ticket 502: 38 m³ of c32/40 x £115 = " + money(38 * 115) + " by hand; the 4-bit copy printed " +
      money(437) + " (£" + (437 / 38).toFixed(2) + " a m³), " + money(38 * 115 - 437) + " short. 16-bit's numbers score: " +
      (160 - COPIES["16"].num) + " slips in 160, about 1 ticket in " + Math.round(160 / (160 - COPIES["16"].num)) +
      ". 16 bits hold " + fmt(Math.pow(2, 16)) + " values, 4 bits " + Math.pow(2, 4) +
      ". each chat token keeps 2 x 80 x 8 x 128 x 2 bytes = " + fmt(KB_PER_TOKEN * 1024) + " bytes, 320 KB.";
  }

  function setStats(api) {
    var R = calc(api.state.C);
    var st = api.state.stat;
    st.mem(R.text.mem);
    st.fits(R.text.fits);
    st.room(R.text.room);
    st.held(R.text.held);
    st.wait(R.wait);
    st.eng(R.text.eng);
    st.num(R.text.num);
    st.loss(R.text.loss);
    st.signoff(R.text.signoff);
    st.wrong(R.text.wrong);
    st.cost(R.text.cost);
    st.speed(R.text.speed);
    st.ticket(R.text.ticket);
  }

  function refresh(api, what) {
    draw(api);
    setStats(api);
    var R = calc(api.state.C);
    if (what) api.log(what + " sign-off: " + R.text.signoff + "; wrong tickets in 22: " + R.text.wrong + "; " + R.text.cost + ".",
      /^fail/.test(R.text.signoff) || !R.fits ? "bad" : (R.ran ? "ok" : "warn"));
  }

  function playNight(api) {
    api.log("18:00  the 4-bit copy goes live on one card: " + calc(defaults()).text.cost + ".", "");
    NIGHT.forEach(function (t) {
      api.log(t.at + "  ticket " + t.n + "  " + t.vol + " m³ " + (t.mix ? t.mix + " " : "") + "x £" + t.price + "  printed " + money(t.printed) +
        "  by hand " + money(t.vol * t.price), t.n === 502 ? "bad" : "warn");
    });
    api.log("23:45  all 22 tickets checked by hand: 3 of 22 wrong. every total worked out by hand until 06:00; the numbers set not yet run on the 4-bit copy.", "bad");
  }

  function planConfig(plan) {
    var C = defaults();
    C.plan = plan;
    if (plan === "r0") { C.prec = "fp8"; C.sets = "both"; }
    if (plan === "r1") { C.extra = true; }
    if (plan === "r2") { C.prec = "16"; C.cards = "2"; C.sets = "both"; }
    if (plan === "r3") { C.check = true; C.sets = "both"; }
    return C;
  }

  function planFollowUp(api, plan) {
    var R = calc(api.state.C);
    if (plan === "r0") {
      var a = calc({ prec: "16", sets: "both", cards: "2", chats: "6", extra: false, check: false });
      var b = calc({ prec: "4", sets: "both", cards: "1", chats: "6", extra: false, check: false });
      api.log("every copy on every set: english " + a.eng + " / " + R.eng + " / " + b.eng + "; numbers " + a.num + " / " +
        R.num + " / " + b.num + " (16-bit / fp8 / 4-bit). fp8 on one card: " + R.text.room + " against a peak of 6; " +
        R.text.cost + "; " + R.text.wrong + " wrong tickets.", "ok");
    }
    if (plan === "r1") api.log("400 english questions: 16-bit 376, 4-bit " + R.text.eng + ", no loss. numbers set never run; in use it gets " +
      COPIES["4"].num + " of 160: " + calc({ prec: "4", sets: "both", cards: "1", chats: "6" }).text.wrong + " wrong tickets.", "bad");
    if (plan === "r2") api.log("16-bit on two cards: numbers " + R.text.num + ", " + R.text.wrong + " wrong tickets; " + R.text.cost +
      ", $" + fmt(monthly(2) - monthly(1)) + " more than one card.", "warn");
    if (plan === "r3") api.log("the 4-bit model re-checks its own sums: numbers " + R.text.num + "; the second try agreed with " +
      (160 - R.num) + " of its 24 wrong totals; " + R.text.wrong + " wrong tickets; " + R.text.cost + ".", "bad");
  }

  /* ---------- the module ---------- */

  DL.sims.define("a10e05", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.ui = buildWidget(api);
      S.ctl = {};
      S.sync = false;
      var IDS = ["prec", "sets", "cards", "chats"];
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
          if (S.C.plan !== "none" || S.C.extra || S.C.check) {
            S.C.plan = "none";
            S.C.extra = false;
            S.C.check = false;
            S.sync = true; S.ctl.plan.set("none"); S.sync = false;
            what += " (reply cleared.)";
          }
          refresh(api, what);
        });
      }
      chooser("prec", "each weight stored as", PRECS);
      chooser("sets", "sets scored", SETS);
      chooser("cards", "cards", CARDS);
      chooser("chats", "chats at the peak", CHATS);
      S.ctl.night = api.control.button("night", "play the night, 18:00 to 01:30", function () {
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
        mem: api.stat("mem", "weights' memory", ""),
        fits: api.stat("fits", "fits the cards", ""),
        room: api.stat("room", "room for chats", ""),
        held: api.stat("held", "chats held at the peak", ""),
        wait: api.stat("wait", "chats waiting", "warn"),
        eng: api.stat("eng", "english set", ""),
        num: api.stat("num", "numbers set", "warn"),
        loss: api.stat("loss", "lost against 16-bit", "warn"),
        signoff: api.stat("signoff", "the sign-off says", ""),
        wrong: api.stat("wrong", "wrong tickets expected in a night", "bad"),
        cost: api.stat("cost", "card bill", ""),
        speed: api.stat("speed", "fastest writing (the memory road)", ""),
        ticket: api.stat("ticket", "ticket 502, 38 m³ x £115", "bad")
      };

      api.info("<strong>How to read it.</strong> Each row is one copy of the same model, its weights stored in fewer or more bits. The english and numbers columns are the plant's own scores on its two task sets; a question mark means the set was not run on that copy. Wrong tickets are what the numbers score predicts for a night of 22. The bold row is the copy chosen.");

      draw(api);
      setStats(api);
      api.log("17:30 on thursday 17 september: the 4-bit copy is signed off on the english set; the switch is at 18:00.", "");
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before the 18:00 switch: the sign-off as Eyvind ran it.
      t.expect(t.stat("mem") === "about 34 GB (33 + 1 of scales)" && t.stat("fits") === "yes: 34 + 4 of 80 GB" &&
        t.stat("eng") === "186 of 200" && t.stat("num") === "not run" && t.stat("signoff") === "pass: no loss on the english set" &&
        t.stat("cost") === "$2,913 a month" && t.stat("ticket") === "printed £437.00, by hand £4,370.00" &&
        has("17:30 on thursday 17 september"),
        "Opens before 18:00: the 4-bit copy, about 34 GB on one card, English 186 of 200, numbers not run, $2,913 a month");

      // 2. The night as it happened.
      t.click("night");
      t.expect(has("23:40  ticket 502  38 m³ c32/40 x £115  printed £437.00  by hand £4,370.00") &&
        has("19:05  ticket 484  12 m³ x £106  printed £1,212.00  by hand £1,272.00") &&
        has("all 22 tickets checked by hand: 3 of 22 wrong.") && has("18:00  the 4-bit copy goes live on one card: $2,913 a month."),
        "The night: the switch at 18:00, ticket 502 at £437.00 against £4,370.00, 3 of 22 wrong");

      // 3. Both sets on the 4-bit copy.
      t.set("sets", "both");
      t.expect(t.stat("num") === "136 of 160" && t.stat("loss") === "english 2 of 200 (1%), numbers 18 of 160 (11%)" &&
        t.stat("wrong") === "3.3 of 22" && t.stat("signoff") === "fail: numbers, 18 more wrong of 160",
        "4-bit on both sets: 136 of 160, 18 more wrong, 3.3 wrong tickets in 22, the sign-off fails");

      // 4. 16-bit does not fit one card; on two it fits.
      t.set("prec", "16");
      var noFit = t.stat("fits") === "no: 132 + 4 GB > 80" && t.stat("room") === "none";
      t.set("cards", "2");
      t.expect(noFit && t.stat("room") === "20 GB: 65,536 tokens, 40 chats" && t.stat("cost") === "$5,825 a month" &&
        t.stat("num") === "154 of 160" && t.stat("eng") === "188 of 200" && t.stat("wrong") === "0.8 of 22",
        "16-bit: about 132 GB does not fit one card; on two, 40 chats, $5,825 a month, 188 and 154, 0.8 wrong tickets in 22");

      // 5. FP8 on one card.
      t.set("prec", "fp8");
      t.set("cards", "1");
      t.expect(t.stat("mem") === "about 66 GB" && t.stat("room") === "10 GB: 32,768 tokens, 20 chats" &&
        t.stat("held") === "6 of 6" && t.stat("wait") === 0 && t.stat("eng") === "188 of 200" &&
        t.stat("num") === "153 of 160" && t.stat("wrong") === "1.0 of 22" && t.stat("signoff") === "pass: within 1% on both sets",
        "FP8 on one card: 80 - 66 - 4 = 10 GB, 32,768 tokens, 20 chats against a peak of 6; 188 and 153; passes both");

      // 6. The cold case: 24 chats at the peak.
      t.set("chats", "24");
      var oneCard = t.stat("wait") === 4 && t.stat("held") === "20 of 24";
      t.set("cards", "2");
      t.expect(oneCard && t.stat("room") === "86 GB: 281,804 tokens, 176 chats" && t.stat("wait") === 0 && t.stat("cost") === "$5,825 a month",
        "24 chats: FP8 on one card holds 20 and 4 wait; on two cards 176, nobody waits, $5,825 a month");

      // 7. The 4-bit copy holds 86 chats on one card, at its numbers score.
      t.set("prec", "4");
      t.set("cards", "1");
      t.expect(t.stat("room") === "42 GB: 137,625 tokens, 86 chats" && t.stat("wait") === 0 && t.stat("num") === "136 of 160" &&
        t.stat("speed") === "about 92 tokens a second",
        "4-bit on one card: 42 GB, 86 chats, still 136 of 160, about 92 tokens a second");

      // 8. Reply 0: score every copy on every set.
      t.set("plan", "r0");
      t.expect(has("every copy on every set: english 188 / 188 / 186; numbers 154 / 153 / 136 (16-bit / fp8 / 4-bit). fp8 on one card: 10 GB: 32,768 tokens, 20 chats against a peak of 6; $2,913 a month; 1.0 of 22 wrong tickets.") &&
        t.stat("speed") === "about 47 tokens a second",
        "Reply 0: FP8 on one card, 188 and 153, 20 chats against 6, $2,913, about 47 tokens a second");

      // 9. Reply 1: 200 more English questions.
      t.set("plan", "r1");
      t.expect(t.stat("eng") === "372 of 400" && t.stat("signoff") === "pass: no loss on the english set" &&
        has("400 english questions: 16-bit 376, 4-bit 372 of 400, no loss. numbers set never run; in use it gets 136 of 160: 3.3 of 22 wrong tickets."),
        "Reply 1: 376 against 372 of 400 passes; the numbers set is never run; 3.3 wrong tickets in 22");

      // 10. Reply 2: keep 16-bit on two cards.
      t.set("plan", "r2");
      t.expect(has("16-bit on two cards: numbers 154 of 160, 0.8 of 22 wrong tickets; $5,825 a month, $2,912 more than one card."),
        "Reply 2: right as before, 154, at $2,912 a month more");

      // 11. Reply 3: the 4-bit model checks its own sums.
      t.set("plan", "r3");
      t.expect(t.stat("num") === "139 of 160" &&
        has("the 4-bit model re-checks its own sums: numbers 139 of 160; the second try agreed with 21 of its 24 wrong totals; 2.9 of 22 wrong tickets; $2,913 a month."),
        "Reply 3: 139 of 160, 21 of 24 wrong totals agreed, 2.9 wrong tickets in 22");

      // 12. Changing a control clears the reply.
      t.set("sets", "eng");
      t.expect(t.stat("num") === "not run" && t.stat("wrong") === "not measured: numbers set not run" && has("(reply cleared.)"),
        "English only: the numbers score is not run and the wrong tickets are not measured");
    }
  });
})();
