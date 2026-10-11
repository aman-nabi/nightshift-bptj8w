/* sims/s4e07-v1.0.0.js  (published as sims/s4e07.js)
   Case s4e07 "The Ticket Number": a payment lab for the box office of the Orrery Picture House in
   Kilbarrow, a single-screen cinema. Two tills sell the last seats for the sold-out midnight
   screening; each till's card terminal sends the payment to Carrowpay, the payment service, waits
   for an answer, and tries again when none comes. The learner replays the box office from 23:00
   to 23:58 with a different terminal timeout, number of retries, key mode (no key, a new key on
   every try, one key per sale: the ticket number), Carrowpay's "similar charge" check, and a
   second sale paid with the same card at the other till, and reads each sale's charges, the
   customers charged twice, the refunds owed and what Carrowpay stored for each key.
   Widget-style sim: it draws its own table inside api.root and replays the whole night at once.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: 36 stated sales; controls for Run the night, terminal
     timeout (5, 10, 15, 20, 30 s), retries (0 to 3), key mode, the similar-charge check, two tills
     sharing a card, Reset. Stats: sales, charges made, customers charged twice, overcharged,
     refunds owed, seats handed over unpaid, longest wait at a terminal, keys Carrowpay holds, 409
     answers. selfTest: 11 assertions.

   The model (stated in sim.lede):
   - SALES below: 36 card sales, ticket numbers 0001 to 0036, each with its time, till, seats and
     how long Carrowpay takes over that card's first payment of the night. Seats are 9.50 pounds
     each. Every sale starts at its stated time; the sim doesn't make later customers wait.
   - Carrowpay: a request it processes takes the sale's stated time for a card's first payment, or
     2.0 s if the same card has had a request processed in the last 5 minutes (the slow step is a
     check it does once per card). The charge is made, and the answer sent, when the request
     finishes. A request it does not finish in time still finishes and still charges.
   - Key modes. None: Carrowpay can't tell a retry from a new payment. A new key on every try: the
     same, in practice. One key per sale: the ticket number, made when the sale is rung up and sent
     with every try. Carrowpay stores each key it sees with its result and keeps it for 24 hours: a
     repeat key whose first request has finished gets the stored result (no new charge, as Stripe's
     Idempotent-Replayed); a repeat key whose first request is still running gets 409 Conflict at
     once (the IETF draft's answer for a concurrent request).
   - The similar-charge check (off as built): before processing any request, Carrowpay looks for a
     finished charge of the same amount on the same card in the last 60 s, and if it finds one it
     answers APPROVED with that charge instead of charging. It sees only finished charges.
   - The terminal: each try waits up to the timeout. No answer: if it has retries left it sends
     again at once, otherwise it shows FAILED. A 409: if it has retries left it waits 3 s and sends
     again with the same key, otherwise FAILED. After FAILED the cashier asks the customer to pay
     again, and the new payment starts 15 s later with a fresh set of retries (and, with one key
     per sale, the same ticket number). At most 3 payments per sale.
   - Ties: an answer that arrives at the very moment of the timeout counts. Times are kept in
     tenths of a second.

   Where every number comes from (conventions rule 14; the case is content/s4/s4e07-v1.0.0.json).
   All counts below come from the model and SALES and are checked by the selfTest.
   - As built (no key, timeout 10 s, 2 retries, no check, different cards): sales 0001 to 0022
     (23:01 to 23:39) take 1.5 to 2.6 s and are charged once. From 23:40 the first payment takes
     9.4 to 12.8 s. 0023 (9.4 s) and 0026 (9.8 s) answer in time. The other 12 time out at 10 s;
     the retry is a repeat card, finishes at 12.0 s and charges again, while the first try finishes
     at 10.6 to 12.8 s and charges too: 48 charges, 12 customers charged twice, 24 seats, 228.00
     pounds overcharged, 12 refunds owed. Longest wait 12.0 s.
   - Sale 0033, seat F7, Mrs Bellwether, 1 seat, 9.50: try 1 23:52:10.0, try 2 23:52:20.0, charged
     23:52:22.0 (try 2) and 23:52:22.1 (try 1). One seat, sold once, paid for twice.
   - A new key on every try: the same 48 charges, 12 twice, 228.00; Carrowpay holds 48 keys.
   - One key per sale: 36 charges, none twice; 12 answers of 409 at 10 s, then the stored result at
     13 s: longest wait 13.0 s; 36 keys.
   - Never retry (0 retries, no key): the 12 show FAILED at 10 s, pay again at 25 s (2.0 s, a repeat
     card), approved at 27 s: still 12 twice, 228.00, longest wait 27.0 s.
   - The similar-charge check, no key, 2 retries: the retry at 10 s finds nothing (the first charge
     finishes later): still 12 twice, 228.00. With two tills sharing a card (0029 pays with 0028's
     card, both 2 seats, 19.00): 0029 at 23:47:20 finds 0028's charge of 23:47:11.5 and is approved
     without a charge: 11 twice, 209.00, 2 seats unpaid.
   - Two tills sharing a card, as built: 0029 is a repeat card (2.0 s): 11 twice, 209.00, 11
     refunds owed. With one key per sale: 36 charges, none twice, none unpaid.
   - Timeout 15 s, no key: nobody twice (the slowest first payment is 12.8 s). Timeout 5 s, no key:
     0023 and 0026 time out too: 14 twice, 28 seats, 266.00 pounds, longest wait 7.0 s.
   - Next Friday in the Part 2s is the same queue with 0029 on 0028's card (the pair toggle on):
     one key per sale: 36 charges, none twice, 11 answers of 409, longest wait 13.0 s; never retry:
     11 twice, 209.00, longest wait 27.0 s; the similar-charge check: 11 twice, 209.00, 2 seats
     unpaid, 46 charges; refunds each morning (as built): 11 twice, 209.00, 11 refunds owed.
   - One key per sale, 1 retry: the 409 uses the last retry, FAILED at 10 s, pay again at 25 s with
     the same ticket number, stored result: none twice, longest wait 25.0 s.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PRICE = 950;           // pence per seat
  var REPEAT = 20;           // tenths: a repeat card's request
  var CARD_MEMORY = 3000;    // tenths: 5 minutes
  var CHECK_WINDOW = 600;    // tenths: the similar-charge check looks back 60 s
  var WAIT_409 = 30;         // tenths: the terminal waits 3 s after a 409
  var PAY_AGAIN = 150;       // tenths: the customer pays again 15 s after FAILED
  var MAX_PAYMENTS = 3;

  // [time since 23:00:00 in seconds, till, seats, card (last four), first-payment time in tenths]
  var SALES = [
    [70, 1, 2, "4471", 18], [185, 2, 1, "0926", 21], [340, 1, 4, "7713", 16], [435, 2, 2, "3358", 24],
    [540, 1, 1, "8840", 19], [690, 2, 3, "2265", 22], [800, 1, 2, "5097", 17], [945, 2, 2, "6134", 26],
    [1030, 1, 1, "9402", 20], [1170, 2, 2, "1586", 15], [1265, 1, 3, "7329", 23], [1370, 2, 1, "4058", 18],
    [1480, 1, 2, "2617", 21], [1575, 2, 4, "8893", 19], [1680, 1, 1, "3041", 25], [1785, 2, 2, "5572", 16],
    [1880, 1, 2, "6608", 22], [1985, 2, 1, "1937", 17], [2090, 1, 3, "7485", 20], [2170, 2, 2, "2754", 24],
    [2260, 1, 1, "9116", 19], [2355, 2, 2, "4380", 21],
    [2430, 1, 2, "5819", 94], [2510, 2, 1, "3672", 112], [2585, 1, 3, "8204", 118], [2660, 2, 2, "1453", 98],
    [2740, 1, 2, "6927", 126], [2820, 1, 2, "2088", 115], [2840, 2, 2, "7361", 123], [2920, 1, 1, "4795", 106],
    [3005, 2, 4, "9530", 119], [3090, 1, 2, "3216", 128], [3130, 2, 1, "6402", 121], [3225, 1, 3, "5148", 111],
    [3320, 2, 2, "8657", 124], [3420, 1, 1, "2983", 109]
  ];
  var PAIR_FROM = 27;        // index of sale 0028
  var PAIR_TO = 28;          // index of sale 0029
  var EERIE = 32;            // index of sale 0033, seat F7

  var TIMEOUTS = [5, 10, 15, 20, 30];
  var MODES = [
    { value: "none", label: "No key (as built)" },
    { value: "per-try", label: "A new key on every try" },
    { value: "per-sale", label: "One key per sale: the ticket number" }
  ];
  var MODE_SHORT = { none: "no key", "per-try": "a new key on every try", "per-sale": "one key per sale" };

  /* ---------- small helpers ---------- */

  function pad(n, w) { var s = String(n); while (s.length < w) s = "0" + s; return s; }
  function ticket(i) { return pad(i + 1, 4); }
  function money(p) { return "£" + (p / 100).toFixed(2); }
  function secs(d) { return (d / 10).toFixed(1) + " s"; }
  // d: tenths of a second since 23:00:00
  function clock(d, tenths) {
    var s = Math.floor(d / 10);
    var out = "23:" + pad(Math.floor(s / 60), 2) + ":" + pad(s % 60, 2);
    return tenths ? out + "." + (d % 10) : out;
  }
  function num(v) { return Number(String(v).replace(/[^0-9.\-]/g, "")); }

  /* ---------- the model (a pure function the display and self-tests read) ---------- */

  function cardOf(C, i) { return C.pair && i === PAIR_TO ? SALES[PAIR_FROM][3] : SALES[i][3]; }
  function seatsOf(i) { return SALES[i][2]; }
  function amountOf(i) { return SALES[i][2] * PRICE; }

  function replay(C) {
    var T = C.timeout * 10;
    var events = [];
    var seq = 0;
    var charges = [];
    var store = {};
    var storeOrder = [];
    var lastSeen = {};
    var conflicts = 0;
    var keyCount = 0;
    var sales = SALES.map(function (s, i) {
      return { i: i, start: s[0] * 10, card: cardOf(C, i), amount: amountOf(i), state: "waiting", cur: null,
        left: 0, payments: 0, tries: 0, key: null, at: null, paidBy: null, failed: 0, trace: [] };
    });
    // priority: answers before timeouts at the same moment
    function push(t, pri, kind, data) { events.push({ t: t, pri: pri, n: seq++, kind: kind, d: data }); }
    function nextKey(s, fresh) {
      if (C.mode === "none") return null;
      if (C.mode === "per-sale") return "T-" + ticket(s.i);
      if (fresh || s.key === null) { keyCount += 1; return "K-" + pad(keyCount, 3); }
      return s.key;
    }
    function send(t, s, freshKey) {
      s.tries += 1;
      var tr = { id: s.i + ":" + s.tries, n: s.tries, at: t };
      s.cur = tr.id;
      s.key = nextKey(s, freshKey);
      s.trace.push("try " + s.tries + " " + clock(t, true));
      push(t + T, 2, "deadline", { s: s, id: tr.id });
      var key = s.key;
      if (key !== null && store[key]) {
        var rec = store[key];
        if (rec.done > t) { conflicts += 1; push(t, 0, "answer", { s: s, id: tr.id, kind: "409" }); }
        else push(t, 0, "answer", { s: s, id: tr.id, kind: "stored", charge: rec.charge });
        return;
      }
      if (C.check) {
        for (var k = charges.length - 1; k >= 0; k--) {
          var c = charges[k];
          if (c.t <= t && c.t >= t - CHECK_WINDOW && c.card === s.card && c.amount === s.amount) {
            if (key !== null) { store[key] = { done: t, charge: c, at: t }; storeOrder.push(key); }
            push(t, 0, "answer", { s: s, id: tr.id, kind: "found", charge: c });
            return;
          }
        }
      }
      var seen = lastSeen[s.card];
      var took = (seen !== undefined && t - seen <= CARD_MEMORY) ? REPEAT : SALES[s.i][4];
      lastSeen[s.card] = t;
      var done = t + took;
      if (key !== null) { store[key] = { done: done, charge: null, at: t }; storeOrder.push(key); }
      push(done, 0, "finish", { s: s, id: tr.id, key: key, n: tr.n });
    }
    function pay(t, s) {
      s.payments += 1;
      s.left = C.retries;
      s.state = "paying";
      send(t, s, true);
    }
    function fail(t, s) {
      s.failed += 1;
      s.cur = null;
      s.trace.push("FAILED " + clock(t, true));
      if (s.payments < MAX_PAYMENTS) push(t + PAY_AGAIN, 1, "again", { s: s });
      else s.state = "failed";
    }
    sales.forEach(function (s) { push(s.start, 1, "start", { s: s }); });
    var guard = 0;
    while (events.length && guard < 5000) {
      guard += 1;
      events.sort(function (a, b) { return (a.t - b.t) || (a.pri - b.pri) || (a.n - b.n); });
      var e = events.shift();
      var s = e.d.s;
      if (e.kind === "start" || e.kind === "again") { pay(e.t, s); continue; }
      if (e.kind === "retry") { if (s.state === "paying" && s.cur === null) send(e.t, s, false); continue; }
      if (e.kind === "finish") {
        var ch = { t: e.t, card: s.card, amount: s.amount, sale: s.i, tryN: e.d.n };
        charges.push(ch);
        s.trace.push("charged " + clock(e.t, true) + " (try " + e.d.n + ")");
        if (e.d.key !== null) store[e.d.key].charge = ch;
        push(e.t, 0, "answer", { s: s, id: e.d.id, kind: "approved", charge: ch });
        continue;
      }
      if (s.state !== "paying" || s.cur !== e.d.id) continue;   // a late answer nobody waits for
      if (e.kind === "answer") {
        if (e.d.kind === "409") {
          s.trace.push("409 " + clock(e.t, true));
          if (s.left > 0) { s.left -= 1; s.cur = null; push(e.t + WAIT_409, 1, "retry", { s: s }); }
          else fail(e.t, s);
          continue;
        }
        s.trace.push("APPROVED " + clock(e.t, true) + (e.d.kind === "stored" ? " with the stored result" :
          (e.d.kind === "found" ? " with " + ticket(e.d.charge.sale) + "'s charge" : "")));
        s.state = "approved";
        s.at = e.t;
        s.paidBy = e.d.charge;
        s.cur = null;
        continue;
      }
      if (e.kind === "deadline") {
        if (s.left > 0) { s.left -= 1; send(e.t, s, true); }
        else fail(e.t, s);
      }
    }
    return summarise(C, sales, charges, store, storeOrder, conflicts);
  }

  function summarise(C, sales, charges, store, storeOrder, conflicts) {
    var per = sales.map(function () { return 0; });
    charges.forEach(function (c) { per[c.sale] += 1; });
    var twice = 0;
    var extraP = 0;
    var refunds = 0;
    var unpaid = 0;
    var wait = 0;
    sales.forEach(function (s) {
      if (per[s.i] > 1) { twice += 1; extraP += (per[s.i] - 1) * s.amount; refunds += per[s.i] - 1; }
      if (s.state === "approved") {
        if (s.paidBy && s.paidBy.sale !== s.i && per[s.i] === 0) unpaid += seatsOf(s.i);
        if (s.at - s.start > wait) wait = s.at - s.start;
      }
    });
    return { sales: sales, per: per, charges: charges, store: store, keys: storeOrder.length,
      twice: twice, extraP: extraP, refunds: refunds, unpaid: unpaid, wait: wait, conflicts: conflicts };
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
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;max-height:420px;overflow-y:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var thead = el("thead");
    var hr = el("tr");
    ["ticket", "time", "till", "seats", "amount", "first payment", "tries", "charges", "terminal", "Carrowpay stored"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;padding:2px 6px;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody };
  }

  function rowsFor(S) {
    var C = S.C;
    var R = S.R;
    return SALES.map(function (x, i) {
      var cells = [ticket(i) + (i === EERIE ? " (F7)" : ""), clock(x[0] * 10), "till " + x[1], String(x[2]), money(amountOf(i)),
        (x[4] / 10).toFixed(1) + " s" + (C.pair && i === PAIR_TO ? " (card of 0028)" : "")];
      if (!R) return { cells: cells.concat(["-", "-", "waiting", "-"]), tone: "" };
      var s = R.sales[i];
      var n = R.per[i];
      var term = s.state === "approved" ? "APPROVED " + clock(s.at, true) + (s.failed ? " after FAILED" : "") : "FAILED";
      if (s.state === "approved" && s.paidBy && s.paidBy.sale !== i && n === 0) term += ", with " + ticket(s.paidBy.sale) + "'s charge";
      var stored = "-";
      if (C.mode === "per-sale") {
        var rec = R.store["T-" + ticket(i)];
        stored = rec && rec.charge ? "T-" + ticket(i) + ": charged " + clock(rec.charge.t, true) : "-";
      } else if (C.mode === "per-try") {
        stored = s.tries + (s.tries === 1 ? " key" : " keys") + ", one per try";
      }
      var tone = n > 1 ? "bad" : (n === 0 && s.state === "approved" ? "warn" : "");
      return { cells: cells.concat([String(s.tries), String(n), term, stored]), tone: tone };
    });
  }

  var TONE_STYLE = { bad: "background:rgba(200,60,60,0.16);", warn: "background:rgba(210,150,40,0.18);", "": "" };

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    ui.head.textContent = "Terminal: waits " + C.timeout + " s a try, " + C.retries + (C.retries === 1 ? " retry" : " retries") +
      ", " + MODE_SHORT[C.mode] + ". Similar-charge check: " + (C.check ? "on" : "off") +
      ". 0029 " + (C.pair ? "pays with 0028's card." : "has its own card.") + (R ? "" : " Press Run the night.");
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    rowsFor(S).forEach(function (r) {
      var tr = ui.el("tr", TONE_STYLE[r.tone]);
      r.cells.forEach(function (c) { tr.appendChild(ui.el("td", "padding:2px 6px;", c)); });
      ui.tbody.appendChild(tr);
    });
    S.stat.sales(SALES.length);
    S.stat.charges(R ? R.charges.length : 0);
    S.stat.twice(R ? R.twice : 0);
    S.stat.extra(money(R ? R.extraP : 0));
    S.stat.refunds(R ? R.refunds : 0);
    S.stat.unpaid(R ? R.unpaid : 0);
    S.stat.wait(R ? secs(R.wait) : "none yet");
    S.stat.keys(R ? R.keys : 0);
    S.stat.conflicts(R ? R.conflicts : 0);
  }

  function run(api, why) {
    var S = api.state;
    var C = S.C;
    S.R = replay(C);
    var R = S.R;
    var e = R.sales[EERIE];
    api.log(why + " Replayed 23:00 to 23:58 (" + C.timeout + " s, " + C.retries + (C.retries === 1 ? " retry" : " retries") + ", " +
      MODE_SHORT[C.mode] + (C.check ? ", similar-charge check" : "") + (C.pair ? ", 0029 on 0028's card" : "") + "): " +
      R.charges.length + " charges for 36 sales, " + R.twice + " customers charged twice, " + money(R.extraP) + " overcharged, " +
      R.unpaid + " seats unpaid.", R.twice || R.unpaid ? "bad" : "ok");
    api.log("Sale 0033, seat F7: " + e.trace.join(", ") + ".", R.per[EERIE] > 1 ? "bad" : "");
    draw(api);
  }

  function changed(api, what) {
    if (api.state.R) run(api, what);
    else { api.log(what + " Press Run the night to replay it.", ""); draw(api); }
  }

  /* ---------- the module ---------- */

  DL.sims.define("s4e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { timeout: 10, retries: 2, mode: "none", check: false, pair: false };
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.run = api.control.button("run", "Run the night", function () { run(api, "Run the night."); });
      S.ctl.timeout = api.control.select("timeout", "Terminal waits for an answer", TIMEOUTS.map(function (x) {
        return { value: x, label: x + " s" };
      }), 10, function (v) {
        var x = num(v);
        if (TIMEOUTS.indexOf(x) < 0) return;
        S.C.timeout = x;
        changed(api, "Terminal timeout: " + x + " s.");
      });
      S.ctl.retries = api.control.range("retries", "Retries after no answer", 0, 3, 1, 2, function (v) {
        var x = Math.max(0, Math.min(3, Math.round(num(v))));
        if (!isFinite(x) || x === S.C.retries) return;
        S.C.retries = x;
        changed(api, "Retries: " + x + ".");
      });
      S.ctl.mode = api.control.select("mode", "Key sent with each payment", MODES, "none", function (v) {
        var x = String(v);
        if (!MODE_SHORT[x]) return;
        S.C.mode = x;
        changed(api, "Key: " + MODE_SHORT[x] + ".");
      });
      S.ctl.check = api.control.toggle("check", "Carrowpay looks for a similar charge (same card, same amount, last 60 s)", false, function (on) {
        S.C.check = !!on;
        changed(api, "Similar-charge check: " + (on ? "on." : "off."));
      });
      S.ctl.pair = api.control.toggle("pair", "Two tills share a card (0029 pays with 0028's card)", false, function (on) {
        S.C.pair = !!on;
        changed(api, "0029 " + (on ? "pays with 0028's card." : "has its own card."));
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        sales: api.stat("sales", "card sales", ""),
        charges: api.stat("charges", "charges made", ""),
        twice: api.stat("twice", "customers charged twice", "bad"),
        extra: api.stat("extra", "overcharged", "bad"),
        refunds: api.stat("refunds", "refunds owed", "warn"),
        unpaid: api.stat("unpaid", "seats handed over unpaid", "warn"),
        wait: api.stat("wait", "longest wait at a terminal", ""),
        keys: api.stat("keys", "keys Carrowpay holds", ""),
        conflicts: api.stat("conflicts", "409 answers (key still in progress)", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one card sale at the box office, with its ticket number. " +
        "<em>First payment</em> is how long Carrowpay takes over that card's first payment tonight; a repeat from the same card takes 2.0 s. " +
        "<em>Charges</em> is how many times the card was charged; red rows were charged more than once, amber rows were approved with no charge of their own. " +
        "<em>Carrowpay stored</em> shows what the payment service keeps for the sale's key, when there is one.");
      api.log("The box office queue: 36 card sales from 23:01:10 to 23:57:00, nothing charged yet.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: the queue loaded, nothing charged.
      t.expect(t.stat("sales") === 36 && t.stat("charges") === 0 && t.stat("twice") === 0 && t.stat("extra") === "£0.00" &&
        t.stat("refunds") === 0 && t.stat("wait") === "none yet" && has("36 card sales from 23:01:10 to 23:57:00, nothing charged yet."),
        "Opens before the first sale: 36 sales queued, nothing charged");

      // 2. As built: 12 customers charged twice, 228.00.
      t.click("run");
      t.expect(t.stat("charges") === 48 && t.stat("twice") === 12 && t.stat("extra") === "£228.00" && t.stat("refunds") === 12 &&
        t.stat("unpaid") === 0 && t.stat("wait") === "12.0 s" && t.stat("keys") === 0,
        "As built: 48 charges, 12 customers charged twice, £228.00 overcharged, 12 refunds owed");

      // 3. Seat F7: one seat, sold once, paid for twice, both in the same second.
      t.expect(has("Sale 0033, seat F7: try 1 23:52:10.0, try 2 23:52:20.0, charged 23:52:22.0 (try 2), APPROVED 23:52:22.0, charged 23:52:22.1 (try 1).") &&
        t.api.state.R.per[32] === 2,
        "Sale 0033: try 2 charged at 23:52:22.0 and try 1 at 23:52:22.1");

      // 4. A new key on every try changes nothing for the customer.
      t.set("mode", "per-try");
      t.expect(t.stat("twice") === 12 && t.stat("extra") === "£228.00" && t.stat("keys") === 48,
        "A new key per try: still 12 twice, £228.00, and 48 keys stored");

      // 5. One key per sale: the ticket number.
      t.set("mode", "per-sale");
      t.expect(t.stat("charges") === 36 && t.stat("twice") === 0 && t.stat("extra") === "£0.00" && t.stat("keys") === 36 &&
        t.stat("conflicts") === 12 && t.stat("wait") === "13.0 s" &&
        has("Sale 0033, seat F7: try 1 23:52:10.0, try 2 23:52:20.0, 409 23:52:20.0, charged 23:52:22.1 (try 1), try 3 23:52:23.0, APPROVED 23:52:23.0 with the stored result."),
        "One key per sale: 36 charges, none twice, 12 answers of 409, then the stored result at 13 s");

      // 6. Never retry: FAILED, then pay again.
      t.set("mode", "none");
      t.set("retries", 0);
      t.expect(t.stat("twice") === 12 && t.stat("extra") === "£228.00" && t.stat("wait") === "27.0 s",
        "Never retry: the 12 show FAILED, pay again and are still charged twice; longest wait 27.0 s");

      // 7. The similar-charge check misses every charge still in progress.
      t.set("retries", 2);
      t.set("check", true);
      t.expect(t.stat("twice") === 12 && t.stat("extra") === "£228.00" && t.stat("unpaid") === 0,
        "Similar-charge check: the retry at 10 s finds nothing, still 12 twice");

      // 8. ... and refuses a real second sale on the same card.
      t.set("pair", true);
      t.expect(t.stat("twice") === 11 && t.stat("extra") === "£209.00" && t.stat("unpaid") === 2 && t.stat("charges") === 46,
        "Check with 0029 on 0028's card: 11 twice, £209.00, and 0029's 2 seats approved with no charge");

      // 9. Without the check, two sales on one card are two charges; the timeout alone moves the line.
      t.set("check", false);
      var asBuiltPair = t.stat("twice") === 11 && t.stat("refunds") === 11 && t.stat("unpaid") === 0;
      t.set("mode", "per-sale");
      var keyedPair = t.stat("twice") === 0 && t.stat("charges") === 36 && t.stat("unpaid") === 0;
      t.expect(asBuiltPair && keyedPair, "0029 on 0028's card: 11 twice as built, none with one key per sale, both sales paid");

      // 10. The timeout: 15 s hides tonight's problem; 5 s makes it worse.
      t.set("pair", false);
      t.set("mode", "none");
      t.set("timeout", 15);
      var t15 = t.stat("twice") === 0 && t.stat("charges") === 36;
      t.set("timeout", 5);
      t.expect(t15 && t.stat("twice") === 14 && t.stat("extra") === "£266.00",
        "Timeout 15 s: nobody twice tonight; 5 s: 14 twice, £266.00");

      // 11. One key per sale with a single retry: the 409 uses it up, and paying again finds the stored result.
      t.set("timeout", 10);
      t.set("mode", "per-sale");
      t.set("retries", 1);
      t.expect(t.stat("twice") === 0 && t.stat("charges") === 36 && t.stat("wait") === "25.0 s",
        "One key, 1 retry: FAILED after the 409, the second payment gets the stored result; none twice");
    }
  });
})();
