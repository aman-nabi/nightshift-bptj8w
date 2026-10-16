/* sims/s8e12-v1.0.0.js  (published as sims/s8e12.js)
   Case s8e12 "Exactly Once, Really?": a refund lab for machine 7, Plinthwell Vending's can machine at
   Stannerley bus station, on the night of Thursday 15 April 2027 into Friday 16 April.
   When a vend fails, the machine asks for a refund. The request goes over the phone network to
   Tetherline (the gateway), which puts it on a queue; Ferrovane (the payment provider) takes it off
   the queue and pays the card back. Ferrovane drops a request whose id it has already seen.
   The machine waits 10 seconds for an answer; if none has come, it sends the same refund once more,
   with the same refund number, and takes whichever answer comes first.
   Widget-style sim: it draws inside api.root. Button-driven (api.speed = 0), so self-tests are exact.

   CHANGELOG
   v1.0.0 (2026-10-16) first version: controls round trip, retry wait, automatic retry, gateway
     repeat window, queue exactly-once setting, where the id is made, each hop dropping repeats;
     Play; Reset. Stats: tries sent, second tries, copies reaching Ferrovane, refunds paid, paid
     once, paid twice, money paid twice, refunds total, the settlement, waiting for a person,
     dropped at each hop, the night. A table shows each refund's ids per try and its fate.
     selfTest: 12 assertions.

   Where every number comes from (conventions rule 14; the case is content/s8/s8e12-v1.0.0.json).
   All of it is given data stated in sim.lede; each result is checked by the selfTest.
   - Every can costs 3.50 pounds. That night the machine charged 76 cards (76 x 3.50 = 266.00,
     the settlement's sales); 41 vends from column 4 failed, so 35 cans came out.
   - The 41 failed vends have vend numbers 5131 + floor(i x 52 / 40), i = 0..40: 5131 to 5183.
     The first, vend 5131, failed at 23:21:40; the last refund went at 05:38.
   - Round trips while the mast was worked on: 12 + ((4i + 2) mod 9) seconds, so 12 to 20 s;
     refund 5131 (i = 0) takes 14 s. Before the works: 1 + (i mod 2), so 1 or 2 s.
   - The machine waits 10 s (the lab also offers 30 s). Every round trip of 12 to 20 s is over 10,
     so all 41 refunds are sent twice: 82 tries. Tetherline numbers requests in order from
     t-90211, so refund 5131 is t-90211 and t-90212.
   - As built, Ferrovane sees 82 different ids and pays 82 refunds: 82 x 3.50 = 287.00, of which
     41 x 3.50 = 143.50 was paid twice. Sales 266.00 minus refunds 287.00 = -21.00.
   - Refund 5131: try 1 at 23:21:40, try 2 at 23:21:50, answers at 23:21:54 and 23:22:04.
   - The fix (key m7 plus the vend number, each hop drops repeats): 41 paid once, 143.50 in
     refunds, 266.00 - 143.50 = 122.50 (the 35 cans that came out).
   - Retries off: 41 refunds listed for a person; Ferrovane still pays each try 1 once.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PRICE = 350;                       // pence per can
  var CHARGED = 76;                      // cards charged that night
  var FAILED = 41;                       // vends from column 4 that dropped no can
  var FIRST = 23 * 3600 + 21 * 60 + 40;  // refund 5131's first try, 23:21:40
  var REPORT = 6 * 3600;                 // the settlement report, 06:00:00
  var FIRST_ID = 90211;                  // Tetherline's first request id that night

  function vendOf(i) { return 5131 + Math.floor(i * 52 / 40); }
  function tripOf(i, C) { return C.rtt === "mast" ? 12 + ((4 * i + 2) % 9) : 1 + (i % 2); }

  var RTTS = [
    { value: "mast", label: "12 to 20 s: mast works all night (as that night)" },
    { value: "normal", label: "1 to 2 s: an ordinary night before the works" }
  ];
  var WAITS = [
    { value: "10", label: "10 s (as built)" },
    { value: "30", label: "30 s" }
  ];
  var RETRIES = [
    { value: "on", label: "on: send the same refund once more (as built)" },
    { value: "off", label: "off: list it for a person to check in the morning" }
  ];
  var WINDOWS = [
    { value: "off", label: "off (as built)" },
    { value: "5", label: "drop a repeat from the same machine within 5 s" }
  ];
  var EXACTLY = [
    { value: "off", label: "off (as built)" },
    { value: "on", label: "on: drop a message whose id it saw in the last 5 minutes" }
  ];
  var MINTS = [
    { value: "gateway", label: "at Tetherline: a new request id for every try (as built)" },
    { value: "machine", label: "at the machine: m7 plus the vend number, carried unchanged" }
  ];
  var HOPS = [
    { value: "off", label: "off: only Ferrovane checks (as built)" },
    { value: "on", label: "on: every hop drops a repeat and returns the first answer" }
  ];

  /* ---------- small helpers ---------- */

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(s) {
    s = ((s % 86400) + 86400) % 86400;
    return two(Math.floor(s / 3600)) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }
  function money(p) {
    var neg = p < 0;
    p = Math.abs(p);
    return (neg ? "-" : "") + "£" + Math.floor(p / 100) + "." + two(p % 100);
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the model (pure: the display and self-tests read it) ---------- */

  function night(C) {
    var wait = Number(C.wait);
    var r = {
      rows: [], lines: [], tries: 0, retries: 0, reach: 0, payments: 0, once: 0, twice: 0,
      person: 0, dropGw: 0, dropQ: 0, dropF: 0
    };
    var next = FIRST_ID;
    var gw = {}, q = {}, f = {};
    for (var i = 0; i < FAILED; i++) {
      var vend = vendOf(i);
      var key = "m7-" + vend;
      var trip = tripOf(i, C);
      var sends = [0];
      var person = false;
      if (trip > wait) {
        if (C.retry === "on") sends.push(wait); else person = true;
      }
      var row = { vend: vend, trip: trip, sends: sends, ids: [], fate: [], paid: 0, person: person };
      for (var j = 0; j < sends.length; j++) {
        r.tries += 1;
        if (j > 0) r.retries += 1;
        var id = C.mint === "machine" ? key : "t-" + (next++);
        row.ids.push(id);
        // Hop 1: Tetherline.
        if (j > 0 && C.window === "5" && sends[j] - sends[0] <= 5) {
          r.dropGw += 1; row.fate.push("dropped by the 5 s window"); continue;
        }
        if (C.hops === "on" && gw[id]) {
          r.dropGw += 1; row.fate.push("dropped at Tetherline, first answer returned"); continue;
        }
        gw[id] = true;
        // Hop 2: the queue.
        if ((C.exactly === "on" || C.hops === "on") && q[id]) {
          r.dropQ += 1; row.fate.push("dropped at the queue"); continue;
        }
        q[id] = true;
        // Hop 3: Ferrovane, which always drops an id it has seen.
        r.reach += 1;
        if (f[id]) {
          r.dropF += 1; row.fate.push("dropped at Ferrovane, first answer returned"); continue;
        }
        f[id] = true;
        row.paid += 1;
        r.payments += 1;
        row.fate.push(row.paid > 1 ? "paid again" : "paid");
      }
      if (row.paid === 1) r.once += 1;
      if (row.paid > 1) r.twice += 1;
      if (person) r.person += 1;
      r.rows.push(row);
    }
    r.extra = r.twice * PRICE;
    r.refunds = r.payments * PRICE;
    r.sales = CHARGED * PRICE;
    r.net = r.sales - r.refunds;
    tell(r, C, wait);
    r.how = r.payments + " refunds paid for " + FAILED + " failed vends, " + r.twice + " paid twice (" + money(r.extra) +
      " extra)" + (r.person ? ", " + r.person + " waiting for a person" : "") + ", Plinthwell's night " + money(r.net);
    return r;
  }

  // The log follows refund 5131, the first of the night, hop by hop.
  function tell(r, C, wait) {
    var w = r.rows[0];
    var named = C.mint === "machine";
    function line(t, text, tone) { r.lines.push({ t: t, text: text, tone: tone || "" }); }
    line(FIRST, "refund 5131: try 1 sent" + (named ? " with key m7-5131." : ". Tetherline names it " + w.ids[0] + "."), "");
    if (w.person) {
      line(FIRST + wait, "refund 5131: no answer in " + wait + " s. No automatic retry: it is listed for a person to check in the morning.", "warn");
      line(FIRST + w.trip, "Ferrovane pays " + w.ids[0] + ", but machine 7 has stopped waiting, so nobody hears it.", "warn");
    } else if (w.sends.length > 1) {
      line(FIRST + wait, "refund 5131: no answer in " + wait + " s. try 2 sent with the same refund number" +
        (named ? ", key m7-5131." : ". Tetherline names it " + w.ids[1] + "."), "warn");
      var hop;
      if (named) {
        if (w.fate[1] === "dropped at the queue") hop = "Tetherline passes m7-5131 on; the queue has seen it and drops try 2.";
        else if (w.fate[1] === "dropped at Ferrovane, first answer returned") hop = "Tetherline and the queue pass m7-5131 on; Ferrovane has seen it, drops try 2 and returns the first answer.";
        else hop = "Tetherline has seen m7-5131: it drops try 2 and will return the first answer.";
      } else {
        hop = (C.window === "5" ? "Tetherline's 5 s window: try 2 came " + wait + " s after try 1, so it passes. " : "") +
          (C.exactly === "on" || C.hops === "on" ? "the queue checks " + w.ids[1] + ": new to it, so it passes. " : "") +
          "Ferrovane checks " + w.ids[1] + ": never seen, so it pays again.";
      }
      line(FIRST + wait, hop, w.paid > 1 ? "bad" : "ok");
      line(FIRST + w.trip, "refund 5131: answer to try 1: paid (" + w.ids[0] + ")" + (w.paid > 1 ? "." : ", returned for both tries."), "ok");
      if (w.paid > 1) line(FIRST + wait + w.trip, "refund 5131: answer to try 2: paid again (" + w.ids[1] + ").", "bad");
    } else {
      line(FIRST + w.trip, "refund 5131: answer: paid (" + w.ids[0] + "). No second try needed.", "ok");
    }
    line(FIRST + w.trip + 1, "the other 40 refunds follow the same way, until 05:38.", "");
    line(REPORT, "settlement report: sales " + money(r.sales) + ", refunds " + r.payments + " (" + money(r.refunds) + "), " +
      r.twice + " paid twice (" + money(r.extra) + " extra)" + (r.person ? ", " + r.person + " waiting for a person" : "") + ".",
      r.twice ? "bad" : (r.person ? "warn" : "ok"));
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
    var wrap = el("div", "overflow:auto;max-height:240px;");
    var tb = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["refund", "round trip", "try 1", "try 2", "paid"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;", h)); });
    var th = el("thead");
    th.appendChild(hr);
    tb.appendChild(th);
    var body = el("tbody");
    tb.appendChild(body);
    wrap.appendChild(tb);
    box.appendChild(wrap);
    var sum = el("p", "margin:0;font-size:12px;");
    box.appendChild(sum);
    api.root.appendChild(box);
    return { el: el, head: head, body: body, sum: sum };
  }

  var KEYS = ["tries", "retries", "reach", "payments", "once", "twice", "extra", "refunds", "report", "person",
    "dropGw", "dropQ", "dropF", "outcome"];

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    ui.head.textContent = "round trip: " + pick(RTTS, C.rtt).label + ". retry wait: " + pick(WAITS, C.wait).label +
      ". automatic retry: " + pick(RETRIES, C.retry).label + ". Tetherline's repeat window: " + pick(WINDOWS, C.window).label +
      ". queue exactly-once: " + pick(EXACTLY, C.exactly).label + ". the id is made: " + pick(MINTS, C.mint).label +
      ". each hop drops repeats of the key: " + pick(HOPS, C.hops).label + ".";
    clear(ui.body);
    if (!S.ran) {
      ui.sum.textContent = "Not played yet: it is 23:21:39, a second before vend 5131 fails to drop its can.";
      KEYS.forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var N = night(C);
    N.rows.forEach(function (w) {
      var tr = ui.el("tr");
      var t1 = w.ids[0] + ": " + w.fate[0];
      var t2 = w.person ? "none: waiting for a person" : (w.ids.length > 1 ? w.ids[1] + ": " + w.fate[1] : "not needed");
      [String(w.vend), w.trip + " s", t1, t2, w.paid + "x"].forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.body.appendChild(tr);
    });
    ui.sum.textContent = "The night: " + N.how + ".";
    S.stat.tries(String(N.tries));
    S.stat.retries(String(N.retries));
    S.stat.reach(String(N.reach));
    S.stat.payments(String(N.payments));
    S.stat.once(String(N.once));
    S.stat.twice(String(N.twice));
    S.stat.extra(money(N.extra));
    S.stat.refunds(money(N.refunds));
    S.stat.report("sales " + money(N.sales) + ", refunds " + money(N.refunds) + ", Plinthwell gets " + money(N.net));
    S.stat.person(String(N.person));
    S.stat.dropGw(String(N.dropGw));
    S.stat.dropQ(String(N.dropQ));
    S.stat.dropF(String(N.dropF));
    S.stat.outcome(N.how);
  }

  function change(api, what) {
    api.state.ran = false;
    api.log(what + " Set back to 23:21:39.", "");
    draw(api);
  }

  function play(api) {
    var S = api.state;
    if (S.ran) {
      api.log("the night has already played. Change a setting or reset to play it again.", "");
      return;
    }
    var N = night(S.C);
    N.lines.forEach(function (l) { api.log(clock(l.t) + " " + l.text, l.tone); });
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s8e12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { rtt: "mast", wait: "10", retry: "on", window: "off", exactly: "off", mint: "gateway", hops: "off" };
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
      sel("rtt", "round trip, there and back", RTTS, "rtt");
      sel("wait", "retry wait", WAITS, "wait");
      sel("retry", "automatic retry", RETRIES, "retry");
      sel("window", "Tetherline's repeat window", WINDOWS, "window");
      sel("exactly", "the queue's exactly-once setting", EXACTLY, "exactly");
      sel("mint", "where the id is made", MINTS, "mint");
      sel("hops", "each hop drops repeats of the key", HOPS, "hops");
      api.control.button("run", "Play the night, 23:21:40 to 06:00", function () { play(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        tries: api.stat("tries", "refund tries sent by machine 7", ""),
        retries: api.stat("retries", "second tries", "warn"),
        reach: api.stat("reach", "copies reaching Ferrovane", ""),
        payments: api.stat("payments", "refunds paid", ""),
        once: api.stat("once", "failed vends refunded once", "ok"),
        twice: api.stat("twice", "failed vends refunded twice", "bad"),
        extra: api.stat("extra", "money paid twice", "bad"),
        refunds: api.stat("refunds", "refunds total", ""),
        report: api.stat("report", "the 06:00 settlement", ""),
        person: api.stat("person", "refunds waiting for a person", "warn"),
        dropGw: api.stat("dropGw", "repeats dropped at Tetherline", ""),
        dropQ: api.stat("dropQ", "repeats dropped at the queue", ""),
        dropF: api.stat("dropF", "repeats dropped at Ferrovane", ""),
        outcome: api.stat("outcome", "the night", "")
      };

      api.info("<strong>How to read it.</strong> Each row is one failed vend and its refund. A refund travels three hops: machine 7 to Tetherline, Tetherline to the queue, the queue to Ferrovane. The try columns show the id each try carried and what happened to it. Ferrovane pays any id it hasn't seen, and drops one it has.");

      api.log("Thursday 15 April 2027, 23:21:39, as built: round trips 12 to 20 s, a 10 s retry wait, Tetherline makes a new id for every try. In a second, vend 5131 fails to drop its can.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before vend 5131 fails.
      t.expect(t.stat("twice") === "not run yet" && t.stat("payments") === "not run yet" &&
        has("In a second, vend 5131 fails to drop its can."),
        "Opens at 23:21:39 before the first refund");

      // 2. As built: 82 tries, 82 refunds paid, 41 paid twice, 143.50 extra, sales 266.00 against refunds 287.00.
      t.click("run");
      t.expect(t.stat("tries") === 82 && t.stat("retries") === 41 && t.stat("reach") === 82 && t.stat("payments") === 82 &&
        t.stat("twice") === 41 && t.stat("once") === 0 && t.stat("extra") === "£143.50" && t.stat("refunds") === "£287.00" &&
        t.stat("report") === "sales £266.00, refunds £287.00, Plinthwell gets -£21.00" && t.stat("person") === 0 &&
        has("23:21:50 refund 5131: no answer in 10 s. try 2 sent with the same refund number. Tetherline names it t-90212.") &&
        has("23:22:04 refund 5131: answer to try 2: paid again (t-90212)."),
        "As built: 41 refunds paid twice, £143.50 extra, refunds £287.00 against sales £266.00");

      // 3. A second play is refused until something changes.
      t.click("run");
      t.expect(has("the night has already played."), "A second play is refused");

      // 4. Before the mast works: 1 to 2 s round trips, no retry ever fires.
      t.set("rtt", "normal");
      t.click("run");
      t.expect(t.stat("retries") === 0 && t.stat("twice") === 0 && t.stat("payments") === 41 && t.stat("tries") === 41 &&
        has("23:21:41 refund 5131: answer: paid (t-90211). No second try needed."),
        "An ordinary night: answers in 1 to 2 s, no second tries, each refund paid once");
      t.set("rtt", "mast");

      // 5. Option 0: Tetherline's 5 s window drops nothing, because try 2 comes 10 s after try 1.
      t.set("window", "5");
      t.click("run");
      t.expect(t.stat("dropGw") === 0 && t.stat("twice") === 41 && t.stat("extra") === "£143.50" &&
        has("Tetherline's 5 s window: try 2 came 10 s after try 1, so it passes."),
        "The 5 s window: 0 dropped, still 41 paid twice");
      t.set("window", "off");

      // 6. Option 1: the queue's exactly-once setting sees two different ids and drops nothing.
      t.set("exactly", "on");
      t.click("run");
      t.expect(t.stat("dropQ") === 0 && t.stat("twice") === 41 && t.stat("reach") === 82 &&
        has("the queue checks t-90212: new to it, so it passes."),
        "the queue's exactly-once: 0 dropped, still 41 paid twice");
      t.set("exactly", "off");

      // 7. Option 2: the key made at the machine and every hop dropping repeats: no doubles.
      t.set("mint", "machine");
      t.set("hops", "on");
      t.click("run");
      t.expect(t.stat("twice") === 0 && t.stat("once") === 41 && t.stat("payments") === 41 && t.stat("dropGw") === 41 &&
        t.stat("reach") === 41 && t.stat("extra") === "£0.00" && t.stat("refunds") === "£143.50" &&
        t.stat("report") === "sales £266.00, refunds £143.50, Plinthwell gets £122.50" &&
        has("23:21:54 refund 5131: answer to try 1: paid (m7-5131), returned for both tries."),
        "The fix: 41 refunds, each paid once; Tetherline drops all 41 repeats");

      // 8. The key alone, with only Ferrovane checking: still no doubles, but every repeat travels all the way.
      t.set("hops", "off");
      t.click("run");
      t.expect(t.stat("twice") === 0 && t.stat("reach") === 82 && t.stat("dropF") === 41 && t.stat("dropGw") === 0,
        "the key carried unchanged: Ferrovane drops all 41 repeats itself");

      // 9. Every hop checking, but Tetherline still making a new id per try: nothing is a repeat.
      t.set("mint", "gateway");
      t.set("hops", "on");
      t.click("run");
      t.expect(t.stat("twice") === 41 && t.stat("dropGw") === 0 && t.stat("dropQ") === 0 && t.stat("dropF") === 0,
        "every hop checking new ids: still 41 paid twice");
      t.set("hops", "off");

      // 10. Option 3: no automatic retry. No doubles, 41 refunds wait for a person.
      t.set("retry", "off");
      t.click("run");
      t.expect(t.stat("twice") === 0 && t.stat("person") === 41 && t.stat("payments") === 41 && t.stat("retries") === 0 &&
        has("No automatic retry: it is listed for a person to check in the morning."),
        "retries off: no doubles, 41 refunds listed for a person");

      // 11. Retries off on an ordinary night: answers come in time, nobody is listed.
      t.set("rtt", "normal");
      t.click("run");
      t.expect(t.stat("person") === 0 && t.stat("payments") === 41, "retries off on an ordinary night: nothing waits");
      t.set("rtt", "mast");
      t.set("retry", "on");

      // 12. A 30 s retry wait: tonight's 12 to 20 s round trips never reach it.
      t.set("wait", "30");
      t.click("run");
      t.expect(t.stat("retries") === 0 && t.stat("twice") === 0 && t.stat("payments") === 41,
        "A 30 s wait: no second tries at 12 to 20 s");
    }
  });
})();
