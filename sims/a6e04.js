/* sims/a6e04-v1.0.0.js  (published as sims/a6e04.js)
   Case a6e04 "The Bill at Dawn": a cost ledger for the tasting-note job at Ferrabee's, a wine
   merchant. The job writes one tasting note per new bottle. Since a rewrite on 1 October it runs
   each night as one long conversation, and every request sends all the earlier turns again.
   No real model runs here: every number comes from one stated price list and stated token
   counts. Widget-style sim: it draws its own chart and table inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-15) first version. Controls: bottles (1 to 6,000), request shape (one
     conversation, as since 1 October; one request per bottle), price list (full; the small
     model at a tenth), batch, note length (about 200 tokens; fifty words, about 65 tokens), job
     budget (none; $40), spend alert (none; $50), a plan (one of the four replies), Run, Reset.
     Stats: requests sent, tokens in, tokens out, cost of reading, cost of writing, total, the
     writing's share, the biggest request, the first trimmed bottle, what bottle 5,812's request
     held, when its note was done, when the run ended, the budget, the alert. selfTest: 11
     assertions.

   The model (stated in sim.lede):
   - Standing instructions 1,500 tokens; each bottle's details 300; each note 200 (or 65 with
     the fifty-word cap). One turn = details + note = 500 (or 365).
   - Request k, one conversation: 1,800 + 500 x (earlier turns carried). One request per
     bottle: 1,800 every time.
   - Trim: the code keeps a request at or under 150,000 tokens by dropping the oldest turns,
     so it carries at most floor((150,000 - 1,800) / 500) = 296 earlier turns (406 with 65-token
     notes). The first request that would pass 150,000 is bottle 298 (1,800 + 500 x 297 =
     150,300); from 297 on every request is 1,800 + 500 x 296 = 149,800.
   - Price list: $3 per million tokens sent, $15 per million written (writing costs five times
     reading, as on every row of the provider's pricing page). The small model: a tenth, $0.30
     and $1.50. Batch: half price; only for separate requests (a conversation's turn needs the
     answer before it). Money is kept in units of $0.00000005 so every sum is exact.
   - Time: the job starts at 00:00:00 and sends requests one after another; each takes 0.5 s
     plus 1 s per 50,000 tokens sent (kept in fiftieths of a millisecond). A batch is sent at
     00:00:00; the provider's page says most batches finish within an hour.
   - Budget: before each request, if spend so far plus that request would pass the budget, the
     job stops. Alert: an email once spend passes the line; it stops nothing.

   Where every number comes from (conventions rule 14; the case is content/latent/a6/a6e04-v1.0.0.json):
   - A normal night since 1 October, 40 bottles: 40 x 1,800 + 500 x (0 + 1 + ... + 39) =
     72,000 + 390,000 = 462,000 tokens in, $1.386; 8,000 out, $0.12; $1.51 (1.506). Bottle 40
     sends 21,300 and is done at 00:00:29.
   - Before 1 October, one request per bottle: 40 x (1,800 x $3 + 200 x $15) / 1,000,000 =
     $0.336, 34 cents.
   - Tonight, 6,000 bottles: 297 growing requests (22,512,600) + 5,703 x 149,800 (854,309,400)
     = 876,822,000 tokens in, $2,630.47; 1,200,000 out, $18.00; $2,648.47 (2,648.466). Writing
     0.68%. Bottle 5,812 carries bottles 5,516 to 5,811 (the Riesling is 5,790), done
     05:31:19; bottle 6,000 done 05:42:16. Bottle 298 starts at 00:09:58 and is done 00:10:02.
   - $40 budget, the conversation: bottles 1 to 225 cost $39.69; 226 (114,300 tokens, $0.35)
     would pass $40, so the job stops at 00:06:12.
   - $50 alert, the conversation: spend passes $50 with bottle 254 ($50.33), at 00:07:37.
   - Small model, the conversation: 876,822,000 x $0.30 + 1,200,000 x $1.50 = $263.05 + $1.80 =
     $264.85, 175 times $1.51.
   - Fifty-word notes (65 tokens), the conversation: 869,783,335 in, $2,609.35; 390,000 out,
     $5.85; $2,615.20, $33.27 less. 406 earlier turns fit; from bottle 407 every request is
     149,990 and from 408 the oldest turns are dropped; bottle 5,812 carries 5,406 to 5,811.
   - One request per bottle, 6,000: 10,800,000 in, $32.40; 1,200,000 out, $18.00; $50.40;
     done 00:53:36. With batch, $25.20 (writing 35.71%). Without batch and under $40: stops after
     bottle 4,761 at $39.99, 00:42:31. The small model, batched: $2.52. A normal night (40)
     batched: $0.17.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var INST = 1500;            // standing instructions, tokens
  var REC = 300;              // one bottle's details
  var TRIM = 150000;          // the code keeps each request at or under this
  var U = 20000000;           // money units per dollar ($0.00000005 each)
  var PRICES = {
    full: { inp: 60, out: 300, label: "Full: $3 per million sent, $15 per million written" },
    small: { inp: 6, out: 30, label: "Small model, a tenth: $0.30 and $1.50" }
  };
  var SHAPES = [
    { value: "conv", label: "One conversation (since 1 October)" },
    { value: "one", label: "One request per bottle (before October)" }
  ];
  var NOTES = [
    { value: "200", label: "About 200 tokens (about 150 words)" },
    { value: "65", label: "Fifty words, about 65 tokens" }
  ];
  var BUDGETS = [{ value: "0", label: "None" }, { value: "40", label: "$40 a night" }];
  var ALERTS = [{ value: "0", label: "None" }, { value: "50", label: "Email at $50" }];
  var PLANS = [
    { value: "none", label: "None: set the controls yourself" },
    { value: "r0", label: "Reply: the small model, a tenth the price" },
    { value: "r1", label: "Reply: one request per bottle, batched, $40 budget" },
    { value: "r2", label: "Reply: fifty-word notes" },
    { value: "r3", label: "Reply: a spend alert at $50" }
  ];
  var WATCH = 5812;           // the claret
  var RIESLING = 5790;

  /* ---------- small helpers ---------- */

  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(u) {
    var c = Math.round(u / (U / 100));
    return "$" + fmt(Math.floor(c / 100)) + "." + (c % 100 < 10 ? "0" : "") + (c % 100);
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t50) {
    var s = Math.floor(t50 / 50000);
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s % 3600 / 60)) + ":" + two(s % 60);
  }
  function defaults() {
    return { n: 6000, shape: "conv", price: "full", batch: false, note: 200, budget: 0, alert: 0, plan: "none" };
  }

  /* ---------- the model (pure: config in, night out) ---------- */

  function night(C) {
    var p = PRICES[C.price];
    var batch = C.batch && C.shape === "one";
    var half = batch ? 2 : 1;
    var note = C.note;
    var turn = REC + note;
    var maxPrev = Math.floor((TRIM - INST - REC) / turn);
    var R = {
      sent: 0, tin: 0, tout: 0, inU: 0, outU: 0, biggest: 0, t50: 0, maxPrev: maxPrev,
      batch: batch, stop: null, alert: null, w: null, wDone: null, trim: C.shape === "conv" && C.n > maxPrev + 1 ? maxPrev + 2 : 0,
      points: [], rows: []
    };
    var budgetU = C.budget * U;
    var alertU = C.alert * U;
    var step = Math.max(1, Math.floor(C.n / 300));
    for (var k = 1; k <= C.n; k++) {
      var prev = C.shape === "conv" ? Math.min(k - 1, maxPrev) : 0;
      var inp = INST + REC + turn * prev;
      var cin = inp * p.inp / half;
      var cout = note * p.out / half;
      if (budgetU && R.inU + R.outU + cin + cout > budgetU) {
        R.stop = { k: k, inp: inp, u: R.inU + R.outU, t50: R.t50 };
        break;
      }
      var start = R.t50;
      R.sent += 1;
      R.tin += inp;
      R.tout += note;
      R.inU += cin;
      R.outU += cout;
      if (inp > R.biggest) R.biggest = inp;
      if (!batch) R.t50 += 25000 + inp;
      if (alertU && !R.alert && R.inU + R.outU > alertU) R.alert = { k: k, u: R.inU + R.outU, t50: R.t50 };
      if (k === WATCH) { R.w = prev ? [k - prev, k - 1] : null; R.wDone = R.t50; }
      if (k === 1 || k === 40 || k === R.trim || k === WATCH || k === C.n) {
        R.rows.push({ k: k, inp: inp, prev: prev, u: R.inU + R.outU, start: start, done: R.t50 });
      }
      if (k === 1 || k % step === 0 || k === R.trim || k === R.trim - 1 || k === C.n) R.points.push([k, inp]);
    }
    return R;
  }

  function total(R) { return R.inU + R.outU; }
  function share(R) {
    var t = total(R);
    if (!t) return "0.00%";
    return (Math.round(R.outU * 10000 / t) / 100).toFixed(2) + "%";
  }
  function heldText(R, C) {
    if (C.n < WATCH || (R.stop && R.stop.k <= WATCH)) return "not sent tonight";
    if (!R.w) return "only itself";
    return "bottles " + fmt(R.w[0]) + " to " + fmt(R.w[1]);
  }
  function finishText(R) {
    if (R.batch) return "batch sent 00:00:00; most finish within an hour";
    return clock(R.t50);
  }
  function stopText(R, C) {
    if (!C.budget) return "none set";
    if (!R.stop) return "not reached, " + money(total(R)) + " of $" + C.budget;
    return "stopped after bottle " + fmt(R.stop.k - 1) + " at " + money(R.stop.u) + ", " + clock(R.stop.t50);
  }
  function alertText(R, C) {
    if (!C.alert) return "none set";
    if (!R.alert) return "not reached";
    return "bottle " + fmt(R.alert.k) + ", " + money(R.alert.u) + ", " + clock(R.alert.t50) + "; nothing stopped";
  }

  function summary(C, R) {
    var s = (C.shape === "conv" ? "One conversation" : "One request per bottle") + ", " + fmt(C.n) + " bottles, " +
      (C.price === "full" ? "full price" : "small model") + (R.batch ? ", batched" : "") +
      (C.note === 65 ? ", fifty-word notes" : "") + ": " + fmt(R.sent) + " requests, " + fmt(R.tin) + " tokens in, " +
      fmt(R.tout) + " out. Reading " + money(R.inU) + ", writing " + money(R.outU) + " (" + share(R) + "), total " + money(total(R)) + ".";
    if (R.trim && R.sent >= R.trim) s += " From bottle " + fmt(R.trim) + " the oldest turns are dropped; every request carries " + fmt(INST + REC + (REC + C.note) * R.maxPrev) + " tokens.";
    if (R.wDone !== null) {
      s += " Bottle 5,812's request held " + heldText(R, C) + (R.w && R.w[0] <= RIESLING ? ", the Riesling (5,790) among them" : "") +
        (R.batch ? "." : "; its note was done at " + clock(R.wDone) + ".");
    }
    if (R.stop) s += " Budget: " + stopText(R, C) + "; bottle " + fmt(R.stop.k) + " would pass $" + C.budget + ".";
    else s += R.batch ? " Batch sent at 00:00:00." : " Last note done at " + clock(R.t50) + ".";
    if (C.alert) s += " Alert: " + alertText(R, C) + ".";
    return s;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";
  var X0 = 70, X1 = 640, Y0 = 210, Y1 = 30;

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
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 660 250");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Tokens sent with each request, against bottle number. A conversation climbs by 500 tokens a bottle until the trim holds it just under 150,000; one request per bottle stays flat at 1,800. Dashed lines mark the trim, bottle 5,812 and where a budget stops the job.");
    box.appendChild(svg);
    var wrap = el("div", "overflow-x:auto;", "", box);
    var table = el("table", "width:100%;border-collapse:collapse;", "", wrap);
    return { doc: doc, el: el, head: head, svg: svg, table: table };
  }
  function mk(ui, tag, attrs, text) {
    var e = ui.doc.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, String(attrs[k]));
    if (text) e.textContent = text;
    ui.svg.appendChild(e);
    return e;
  }
  function row(ui, cells, th) {
    var tr = ui.el("tr", "", "", ui.table);
    cells.forEach(function (c) { ui.el(th ? "th" : "td", "text-align:left;padding:2px 4px;", String(c), tr); });
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ui = S.ui;
    var R = S.R;
    ui.head.textContent = pick(SHAPES, C.shape).label + ". " + fmt(C.n) + " bottles. " + PRICES[C.price].label + "." +
      (C.batch ? (C.shape === "one" ? " Batched, half price." : " Batch asked for, but a conversation can't be batched.") : "") +
      " Notes: " + pick(NOTES, String(C.note)).label + ". Budget: " + pick(BUDGETS, String(C.budget)).label + ". Alert: " + pick(ALERTS, String(C.alert)).label + ".";
    while (ui.svg.firstChild) ui.svg.removeChild(ui.svg.firstChild);
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    mk(ui, "line", { x1: X0, y1: Y0, x2: X1, y2: Y0, "class": "dg-axis" });
    mk(ui, "line", { x1: X0, y1: Y0, x2: X0, y2: Y1, "class": "dg-axis" });
    mk(ui, "text", { x: X0 - 6, y: Y1 + 4, "class": "dg-axis", "text-anchor": "end" }, "150k");
    mk(ui, "text", { x: X0 - 6, y: Y0 + 4, "class": "dg-axis", "text-anchor": "end" }, "0");
    mk(ui, "text", { x: X0, y: Y0 + 18, "class": "dg-axis", "text-anchor": "start" }, "bottle 1");
    mk(ui, "text", { x: X1, y: Y0 + 18, "class": "dg-axis", "text-anchor": "end" }, "bottle " + fmt(C.n));
    mk(ui, "text", { x: X0 + 6, y: 16, "class": "dg-note", "text-anchor": "start" }, "tokens sent with each request");
    row(ui, ["bottle", "earlier turns carried", "tokens sent", "spend so far", "done at"], true);
    if (!R) {
      mk(ui, "text", { x: 355, y: 120, "class": "dg-note", "text-anchor": "middle" }, "Midnight. Nothing sent yet.");
      return;
    }
    function px(k) { return X0 + (C.n > 1 ? (k - 1) * (X1 - X0) / (C.n - 1) : 0); }
    function py(v) { return Y0 - v * (Y0 - Y1) / TRIM; }
    var d = R.points.map(function (q, i) { return (i ? "L" : "M") + px(q[0]).toFixed(1) + " " + py(q[1]).toFixed(1); }).join("");
    if (d) mk(ui, "path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 2 });
    function vline(k, label, y) {
      mk(ui, "line", { x1: px(k), y1: Y0, x2: px(k), y2: Y1, "class": "dg-axis", "stroke-dasharray": "4 3" });
      mk(ui, "text", { x: px(k) + (px(k) > 520 ? -4 : 4), y: y, "class": "dg-note", "text-anchor": px(k) > 520 ? "end" : "start" }, label);
    }
    if (R.trim && R.sent >= R.trim) vline(R.trim, "trim from " + fmt(R.trim), 44);
    if (R.stop) vline(R.stop.k - 1, "budget stop after " + fmt(R.stop.k - 1), 64);
    if (C.n >= WATCH && R.sent >= WATCH) vline(WATCH, "5,812", 84);
    R.rows.forEach(function (r) {
      row(ui, [fmt(r.k), fmt(r.prev), fmt(r.inp), money(r.u), R.batch ? "in the batch" : clock(r.done)]);
    });
  }

  function setStats(api) {
    var S = api.state;
    var R = S.R;
    var C = S.C;
    var st = S.stat;
    if (!R) {
      st.sent(0); st.tin(0); st.tout(0); st.incost("$0.00"); st.outcost("$0.00"); st.total("$0.00"); st.share("-");
      st.biggest(0); st.trim("-"); st.held("not sent yet"); st.w5812("-"); st.finish("-"); st.budget(pick(BUDGETS, String(C.budget)).label);
      st.alert(pick(ALERTS, String(C.alert)).label);
      return;
    }
    st.sent(fmt(R.sent));
    st.tin(fmt(R.tin));
    st.tout(fmt(R.tout));
    st.incost(money(R.inU));
    st.outcost(money(R.outU));
    st.total(money(total(R)));
    st.share(share(R));
    st.biggest(fmt(R.biggest));
    st.trim(R.trim && R.sent >= R.trim ? "bottle " + fmt(R.trim) : "no trim");
    st.held(heldText(R, C));
    st.w5812(R.wDone === null ? "-" : (R.batch ? "in the batch" : clock(R.wDone)));
    st.finish(R.stop ? "stopped " + clock(R.stop.t50) : finishText(R));
    st.budget(stopText(R, C));
    st.alert(alertText(R, C));
  }

  function run(api, what) {
    var S = api.state;
    S.R = night(S.C);
    draw(api);
    setStats(api);
    var tone = total(S.R) > 1000 * U ? "bad" : (total(S.R) > 40 * U ? "warn" : "ok");
    if (S.C.batch && S.C.shape === "conv") api.log("Batch can't take one conversation: each turn needs the answer to the turn before, so the requests go one by one at full price.", "warn");
    api.log((what ? what + " " : "") + summary(S.C, S.R), tone);
  }

  function planOutcome(plan) {
    var C = defaults();
    if (plan === "r0") {
      var a = night(C);
      return "Same tokens as tonight, " + fmt(a.tin) + " in; the small model's bill is a tenth of " + money(total(a)) + ", and 175 times a normal night's $1.51.";
    }
    if (plan === "r1") {
      C.budget = 40;
      var b = night(C);
      return "If the conversation came back, the same $40 budget " + stopText(b, C) + ".";
    }
    if (plan === "r2") {
      var c = night(C);
      return "Tonight as built cost " + money(total(c)) + "; the writing was " + money(c.outU) + " of it.";
    }
    return "The email reaches the shop computer upstairs. Nobody reads it until 06:00, and an email stops nothing.";
  }

  /* ---------- the module ---------- */

  DL.sims.define("a6e04", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = defaults();
      S.R = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      function manual(what) {
        if (S.C.plan !== "none") { S.C.plan = "none"; S.ctl.plan.set("none"); what += " (Plan cleared.)"; }
        run(api, what);
      }
      S.ctl.run = api.control.button("run", "Run the night", function () { run(api, ""); });
      S.ctl.n = api.control.range("n", "Bottles tonight", 1, 6000, 1, 6000, function (v) {
        var x = Math.max(1, Math.min(6000, Math.round(Number(v))));
        if (!isFinite(x)) return;
        S.C.n = x;
        manual("Bottles: " + fmt(x) + ".");
      });
      S.ctl.shape = api.control.select("shape", "Request shape", SHAPES, "conv", function (v) {
        var o = pick(SHAPES, v);
        if (!o) return;
        S.C.shape = String(o.value);
        manual("Shape: " + o.label + ".");
      });
      S.ctl.price = api.control.select("price", "Price list", Object.keys(PRICES).map(function (k) { return { value: k, label: PRICES[k].label }; }), "full", function (v) {
        if (!PRICES[String(v)]) return;
        S.C.price = String(v);
        manual("Price: " + PRICES[S.C.price].label + ".");
      });
      S.ctl.batch = api.control.toggle("batch", "Send as one batch (half price)", false, function (on) {
        S.C.batch = !!on;
        manual("Batch: " + (on ? "on." : "off."));
      });
      S.ctl.note = api.control.select("note", "Note length", NOTES, "200", function (v) {
        var o = pick(NOTES, v);
        if (!o) return;
        S.C.note = Number(o.value);
        manual("Notes: " + o.label + ".");
      });
      S.ctl.budget = api.control.select("budget", "Job budget", BUDGETS, "0", function (v) {
        var o = pick(BUDGETS, v);
        if (!o) return;
        S.C.budget = Number(o.value);
        manual("Budget: " + o.label + ".");
      });
      S.ctl.alert = api.control.select("alert", "Spend alert", ALERTS, "0", function (v) {
        var o = pick(ALERTS, v);
        if (!o) return;
        S.C.alert = Number(o.value);
        manual("Alert: " + o.label + ".");
      });
      S.ctl.plan = api.control.select("plan", "Play a reply (replays tonight's 6,000)", PLANS, "none", function (v) {
        var o = pick(PLANS, v);
        if (!o || o.value === "none") return;
        var C = defaults();
        C.plan = String(o.value);
        if (C.plan === "r0") C.price = "small";
        if (C.plan === "r1") { C.shape = "one"; C.batch = true; C.budget = 40; }
        if (C.plan === "r2") C.note = 65;
        if (C.plan === "r3") C.alert = 50;
        S.C = C;
        S.ctl.n.set(C.n); S.ctl.shape.set(C.shape); S.ctl.price.set(C.price); S.ctl.batch.set(C.batch);
        S.ctl.note.set(String(C.note)); S.ctl.budget.set(String(C.budget)); S.ctl.alert.set(String(C.alert));
        run(api, "Plan: " + o.label + ".");
        api.log(planOutcome(C.plan), "");
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        sent: api.stat("sent", "requests sent", ""),
        tin: api.stat("tin", "tokens sent (read)", ""),
        tout: api.stat("tout", "tokens written", ""),
        incost: api.stat("incost", "cost of reading", ""),
        outcost: api.stat("outcost", "cost of writing", ""),
        total: api.stat("total", "the night's bill", "bad"),
        share: api.stat("share", "writing's share of the bill", ""),
        biggest: api.stat("biggest", "biggest request, tokens", ""),
        trim: api.stat("trim", "first trimmed request", "warn"),
        held: api.stat("held", "bottle 5,812's request held", "warn"),
        w5812: api.stat("w5812", "note 5,812 done at", ""),
        finish: api.stat("finish", "the job ended", ""),
        budget: api.stat("budget", "job budget", "ok"),
        alert: api.stat("alert", "spend alert", "")
      };

      api.info("<strong>How to read it.</strong> Each bottle gets one request. The line shows how many tokens each request sends: a conversation climbs by one turn per bottle until the trim holds it just under 150,000; one request per bottle stays at 1,800. The table shows a few bottles: how many earlier turns each request carried, its size, the spend so far, and when its note was done.");

      draw(api);
      setStats(api);
      api.log("Midnight, 14 to 15 October. Tonight's list: 6,000 new bottles from the Kittering estate. Nothing sent yet; $0.00 spent.", "");
    },

    selfTest: async function (t) {
      // The log keeps 14 lines, so each check searches the whole log for a line only that step writes.
      function begin() { return 0; }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: midnight, nothing sent.
      t.expect(t.stat("sent") === 0 && t.stat("total") === "$0.00" && t.stat("held") === "not sent yet" &&
        t.logText().indexOf("Midnight, 14 to 15 October. Tonight's list: 6,000 new bottles from the Kittering estate. Nothing sent yet; $0.00 spent.") >= 0,
        "Opens at midnight with nothing sent and $0.00 spent");

      // 2. Tonight as built: one conversation over 6,000 bottles.
      begin();
      t.click("run");
      t.expect(has("One conversation, 6,000 bottles, full price: 6,000 requests, 876,822,000 tokens in, 1,200,000 out. Reading $2,630.47, writing $18.00 (0.68%), total $2,648.47.") &&
        has("From bottle 298 the oldest turns are dropped; every request carries 149,800 tokens.") &&
        has("Bottle 5,812's request held bottles 5,516 to 5,811, the Riesling (5,790) among them; its note was done at 05:31:19.") &&
        has("Last note done at 05:42:16."),
        "Tonight: 876,822,000 tokens in, $2,648.47, writing 0.68%; trimmed from bottle 298; note 5,812 at 05:31:19 with the Riesling in its history");

      // 3. A normal night since 1 October: 40 bottles.
      t.set("n", 40);
      t.expect(t.stat("tin") === "462,000" && t.stat("total") === "$1.51" && t.stat("biggest") === "21,300" &&
        t.stat("trim") === "no trim" && t.stat("finish") === "00:00:29",
        "40 bottles: 462,000 tokens in, $1.51, biggest request 21,300, done 00:00:29");

      // 4. Before October: one request per bottle, 40 bottles.
      t.set("shape", "one");
      t.expect(t.stat("tin") === "72,000" && t.stat("total") === "$0.34",
        "Before the rewrite: 40 bottles one at a time, 72,000 tokens, $0.34");

      // 5. One request per bottle over the whole estate, then batched.
      t.set("n", 6000);
      var flat = t.stat("total") === "$50.40" && t.stat("biggest") === "1,800" && t.stat("finish") === "00:53:36";
      t.set("batch", true);
      t.expect(flat && t.stat("total") === "$25.20" && t.stat("share") === "35.71%" && t.stat("held") === "only itself",
        "One per bottle: $50.40, done 00:53:36; batched $25.20, note 5,812's request holds only itself");
      t.set("batch", false);

      // 6. The $40 budget against the conversation, and one per bottle without batch.
      t.set("budget", "40");
      var one40 = t.stat("budget") === "stopped after bottle 4,761 at $39.99, 00:42:31";
      t.set("shape", "conv");
      t.expect(one40 && t.stat("sent") === 225 && t.stat("budget") === "stopped after bottle 225 at $39.69, 00:06:12" &&
        t.stat("held") === "not sent tonight",
        "$40 budget: the conversation stops after bottle 225 at $39.69, 00:06:12; one per bottle unbatched after 4,761");
      t.set("budget", "0");

      // 7. Batch can't take a conversation.
      begin();
      t.set("batch", true);
      t.expect(has("Batch can't take one conversation") && t.stat("total") === "$2,648.47",
        "A conversation can't be batched: the bill stays $2,648.47");
      t.set("batch", false);

      // 8. Reply 0: the small model at a tenth.
      begin();
      t.set("plan", "r0");
      t.expect(t.stat("tin") === "876,822,000" && t.stat("total") === "$264.85" && has("175 times a normal night's $1.51"),
        "Reply 0: same 876,822,000 tokens, $264.85, 175 times a normal night");

      // 9. Reply 1: one per bottle, batched, $40 budget; and the budget against the old shape.
      begin();
      t.set("plan", "r1");
      t.expect(t.stat("total") === "$25.20" && t.stat("budget") === "not reached, $25.20 of $40" &&
        has("If the conversation came back, the same $40 budget stopped after bottle 225 at $39.69, 00:06:12."),
        "Reply 1: $25.20 batched, under the $40 budget, which would stop the old shape after bottle 225");

      // 10. Reply 2: fifty-word notes.
      begin();
      t.set("plan", "r2");
      t.expect(t.stat("total") === "$2,615.20" && t.stat("outcost") === "$5.85" && t.stat("tout") === "390,000" &&
        has("From bottle 408 the oldest turns are dropped; every request carries 149,990 tokens.") && t.stat("held") === "bottles 5,406 to 5,811",
        "Reply 2: fifty-word notes, $2,615.20, writing $5.85; trimmed from bottle 408, every request 149,990");

      // 11. Reply 3: an alert at $50.
      t.set("plan", "r3");
      t.expect(t.stat("alert") === "bottle 254, $50.33, 00:07:37; nothing stopped" && t.stat("total") === "$2,648.47",
        "Reply 3: the alert fires at bottle 254, $50.33, 00:07:37, and the night still costs $2,648.47");
    }
  });
})();
