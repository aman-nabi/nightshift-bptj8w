/* sims/a4e02-v1.0.0.js  (published as sims/a4e02.js)
   Case a4e02 "Workflows Before Agents": a workflow lab for Tollervey Fixings, a small fastener factory
   whose night order desk was an agent ("orderdesk") with nine tools. The learner runs the night's own
   twelve emails through five ways of handling them and reads each email's path, steps, cost and result.
   No real model runs here. Widget-style sim: a table and a note built inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: twelve emails (EMAILS), five modes (the agent as that night, the
     agent plus a checker agent, the fixed chain, the fixed chain plus a model at the open step, a person
     each morning), tools granted (all nine, or eight without create_purchase_order), and the longer
     prompt with worked examples. Stats: right, waits for the day shift, wrong, purchase orders raised,
     emails that could reach create_purchase_order, model calls, steps, input and output tokens, the
     night's bill in cents, right orders on the 06:00 run. selfTest: 10 assertions.

   The model (stated in sim.lede):
   - Teaching price: $3 per million input tokens and $15 per million output tokens. Cost in millionths
     of a dollar = input x 3 + output x 15; shown in cents to two places.
   - Agent: a system prompt of 700 tokens and 200 tokens per tool definition (nine tools: 1,800; eight:
     1,600). The longer prompt adds 1,500 tokens of worked examples. Every step is one model call that
     resends the whole context; each step adds 200 tokens to it (an 80-token model output and a
     120-token tool result). An email of e tokens taking s steps costs s x (base + e) + 100 x s x (s - 1)
     input tokens and 80 x s output tokens. Steps per email are the trace's and do not change with the
     prompt or the tools (a teaching rule). Each step takes 24 seconds.
   - Checker agent: one call for each action the first agent proposes (create or change a sales order,
     or create a purchase order): 900 + e + 150 input tokens, 60 output. By the stated rule it rejects an
     action only when its part number is not written in the email; anything that reads like an order and
     matches the email's words, it approves.
   - Fixed chain: step 1 extract, one model call with a JSON schema (600 + e input, 120 output); step 2
     check against the catalogue and the customer accounts, code; step 3 route by type, code. 3 steps,
     1 model call per email. Plus a model at the open step: email 8, the only open question, also gets
     one drafting call (1,400 + e input, 400 output) that writes a reply and quote for sales to send.
   - A person each morning: nothing runs overnight; every email waits for 07:30.

   Where every number comes from (conventions rule 14; the case is content/latent/a4/a4e02-v1.0.0.json).
   - The twelve emails, Wednesday night into Thursday, 22:05 to 05:45, with tokens and agent steps:
     1 22:05 220/6, 2 22:40 160/5, 3 23:15 140/6, 4 23:50 900/2, 5 00:30 200/7, 6 01:10 300/3,
     7 02:18 420/6, 8 03:05 260/9, 9 03:40 180/5, 10 04:25 120/4, 11 05:10 240/3, 12 05:45 200/5.
   - The agent as that night (nine tools, its first prompt): 61 steps, 61 calls, 196,520 input tokens,
     4,880 output, 66.28 cents. Right 8, waits 1 (email 11), wrong 3 (emails 3, 5, 7). Right orders on
     the 06:00 run: 4 (emails 1, 2, 9, 12). Emails that could reach create_purchase_order: 12.
   - Email 7, 02:18:00, Rosevear Brassware's promotion. Steps: read_email, search_catalogue (HG-75-BR,
     bought-in), check_stock (36 in stock), lookup_customer (not a customer), create_purchase_order,
     a summary. Step 5 ends at 02:18:00 + 5 x 24 s = 02:20:00: PO-30117, 400 x HG-75-BR at 2.87 GBP
     (4.10 less 30 percent), 1,148.00 GBP. Rosevear's system confirmed it at 02:21 (stated data).
     Email 7 alone: 20,520 input, 480 output, 6.88 cents. Email 8 alone: 32,040 input, 10.69 cents.
     Email 4 alone (the newsletter, 2 steps): 7,000 input, 160 output, 2.34 cents.
   - The fixed chain: 36 steps, 12 calls, 10,540 input, 1,440 output, 5.32 cents. Right 9, waits 3
     (5, 8, 11), wrong 0. Right orders on the run: 5. Could reach create_purchase_order: 0.
   - Plus a model at the open step: 37 steps, 13 calls, 12,200 input, 1,840 output, 6.42 cents. Right
     10, waits 2 (5, 11).
   - Agent with the longer prompt: 288,020 input, 4,880 output, 93.73 cents. Right 10, waits 2 (5, 11),
     wrong 0, purchase orders 0, could reach create_purchase_order 12.
   - Agent plus checker: 7 checks, 68 steps and calls, 205,390 input, 5,300 output, 69.57 cents. Right
     8, waits 2 (5, 11), wrong 2 (3, 7), purchase orders 1.
   - Agent with eight tools: 184,320 input, 62.62 cents. Right 9, waits 1, wrong 2 (3, 5), purchase
     orders 0, could reach create_purchase_order 0.
   - A person each morning: 0 calls, 0.00 cents, waits 12, right orders on the 06:00 run 0.
*/
(function () {
  "use strict";

  var IN_PRICE = 3;
  var OUT_PRICE = 15;
  var SYS = 700;
  var PER_TOOL = 200;
  var EXAMPLES = 1500;
  var STEP_ADD = 200;
  var STEP_OUT = 80;
  var STEP_SEC = 24;

  // n, time, from, kind, short description, tokens, agent steps
  var EMAILS = [
    { n: 1, t: "22:05", from: "a boatyard", kind: "order", what: "2,000 M8 stainless bolts and nuts", e: 220, s: 6 },
    { n: 2, t: "22:40", from: "a kitchen fitter", kind: "order", what: "5,000 wood screws 4 x 40", e: 160, s: 5 },
    { n: 3, t: "23:15", from: "a gate maker", kind: "change", what: "SO-4471: M6 washers 3,000, not 2,000", e: 140, s: 6 },
    { n: 4, t: "23:50", from: "a trade association", kind: "info", what: "monthly newsletter", e: 900, s: 2 },
    { n: 5, t: "00:30", from: "a shopfitter", kind: "order", what: "1,000 hex bolts M10 x 55", e: 200, s: 7 },
    { n: 6, t: "01:10", from: "a wire supplier", kind: "supplier", what: "invoice for steel wire", e: 300, s: 3 },
    { n: 7, t: "02:18", from: "Rosevear Brassware", kind: "supplier", what: "promotion: 400 brass hinges, 30 percent off", e: 420, s: 6 },
    { n: 8, t: "03:05", from: "a jetty builder", kind: "question", what: "which fixings for a 40 m salt-water jetty?", e: 260, s: 9 },
    { n: 9, t: "03:40", from: "a fencing firm", kind: "order", what: "repeat order, 3,000 coach screws", e: 180, s: 5 },
    { n: 10, t: "04:25", from: "a roofer", kind: "delivery", what: "where is Monday's delivery?", e: 120, s: 4 },
    { n: 11, t: "05:10", from: "an unknown sender", kind: "order", what: "800 roofing bolts, no account", e: 240, s: 3 },
    { n: 12, t: "05:45", from: "a caravan maker", kind: "order", what: "2,500 self-tapping screws", e: 200, s: 5 }
  ];
  var CUSTOMER_ORDER = { 1: true, 2: true, 3: true, 5: true, 9: true, 11: true, 12: true };

  var MODES = [
    { value: "agent", label: "The agent, as that night" },
    { value: "checker", label: "The agent plus a checker agent" },
    { value: "chain", label: "Fixed chain: extract, check, route" },
    { value: "open", label: "Fixed chain plus a model at the open step" },
    { value: "person", label: "A person reads every email at 07:30" }
  ];
  var TOOLS = [
    { value: "9", label: "All nine, with create_purchase_order" },
    { value: "8", label: "Eight: no create_purchase_order" }
  ];

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function cents(micro) { return (Math.round(micro / 100) / 100).toFixed(2); }
  function isAgent(C) { return C.mode === "agent" || C.mode === "checker"; }
  function clock(hhmm, addSec) {
    var p = hhmm.split(":");
    var s = Number(p[0]) * 3600 + Number(p[1]) * 60 + addSec;
    function two(x) { return (x < 10 ? "0" : "") + x; }
    return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60);
  }

  /* ---------- the model: one email through one configuration ---------- */

  function agentRun(C, m) {
    var base = SYS + PER_TOOL * Number(C.tools) + (C.better ? EXAMPLES : 0);
    var r = {
      steps: m.s, calls: m.s,
      tin: m.s * (base + m.e) + (STEP_ADD / 2) * m.s * (m.s - 1),
      tout: STEP_OUT * m.s, res: "right", po: false, note: "", path: m.s + " steps"
    };
    var proposes = m.kind === "order" || m.kind === "change";
    if (m.n === 11) proposes = false;
    if (m.n === 5 && C.better) proposes = false;
    var poAttempt = m.n === 7 && C.tools === "9" && !C.better;
    var ck = C.mode === "checker" ? ", checker approved" : "";
    if (m.n === 1 || m.n === 2 || m.n === 9 || m.n === 12) r.note = "sales order made" + ck;
    else if (m.n === 3) {
      if (C.better) r.note = "SO-4471 changed to 3,000 washers" + ck;
      else { r.res = "wrong"; r.note = "a new order for 3,000 more washers; SO-4471 still has 2,000" + ck; }
    } else if (m.n === 4) r.note = "read, nothing to do";
    else if (m.n === 5) {
      if (C.better) { r.res = "waits"; r.note = "forwarded: no M10 x 55 in the catalogue"; }
      else if (C.mode === "checker") { r.res = "waits"; r.note = "checker rejected M10 x 60: not in the email"; }
      else { r.res = "wrong"; r.note = "guessed M10 x 60 and made the order"; }
    } else if (m.n === 6) r.note = "forwarded to accounts";
    else if (m.n === 7) {
      if (poAttempt) {
        r.res = "wrong"; r.po = true;
        r.note = clock(m.t, 5 * STEP_SEC) + " create_purchase_order: PO-30117, 400 x HG-75-BR at 2.87 GBP (4.10 less 30 percent), 1,148.00 GBP" +
          (C.mode === "checker" ? ", checker approved" : "");
      } else if (C.tools === "8") r.note = "no purchase order tool; forwarded to purchasing";
      else r.note = "forwarded to purchasing";
    } else if (m.n === 8) r.note = "drafted a reply and quote for sales";
    else if (m.n === 10) r.note = "drafted a reply from the dispatch record";
    else if (m.n === 11) { r.res = "waits"; r.note = "no account; forwarded to a person"; }
    if (C.mode === "checker" && (proposes || poAttempt)) {
      r.calls += 1; r.steps += 1;
      r.tin += 900 + m.e + 150; r.tout += 60;
      r.path += " + check";
    }
    return r;
  }

  function chainRun(C, m) {
    var r = { steps: 3, calls: 1, tin: 600 + m.e, tout: 120, res: "right", po: false, note: "", path: "" };
    var check = "ok";
    if (m.n === 5) check = "no M10 x 55";
    if (m.n === 11) check = "no account";
    var route = {
      order: "06:00 run", change: "order changed", info: "archive", supplier: "purchasing inbox",
      question: "sales inbox", delivery: "dispatch reply drafted"
    }[m.kind];
    if (m.n === 6) route = "accounts inbox";
    if (check !== "ok") {
      r.res = "waits"; r.path = "extract, check: " + check + ", a person";
      r.note = "failed the catalogue check; waits for a person";
      return r;
    }
    r.path = "extract, check: ok, route: " + m.kind;
    r.note = route;
    if (m.kind === "question") {
      if (C.mode === "open") {
        r.steps += 1; r.calls += 1; r.tin += 1400 + m.e; r.tout += 400;
        r.path += ", draft";
        r.note = "a model drafted a reply and quote for sales";
      } else { r.res = "waits"; r.note = "sales inbox; written in the morning"; }
    }
    return r;
  }

  function personRun(C, m) {
    return { steps: 0, calls: 0, tin: 0, tout: 0, res: "waits", po: false, note: "read at 07:30", path: "none overnight" };
  }

  function runEmail(C, m) {
    if (isAgent(C)) return agentRun(C, m);
    if (C.mode === "person") return personRun(C, m);
    return chainRun(C, m);
  }

  function night(C) {
    var rows = [];
    var tot = { right: 0, waits: 0, wrong: 0, po: 0, reach: 0, calls: 0, steps: 0, tin: 0, tout: 0, micro: 0, run: 0 };
    EMAILS.forEach(function (m) {
      var r = runEmail(C, m);
      r.micro = r.tin * IN_PRICE + r.tout * OUT_PRICE;
      rows.push(r);
      tot[r.res] += 1;
      if (r.po) tot.po += 1;
      if (isAgent(C) && C.tools === "9") tot.reach += 1;
      tot.calls += r.calls; tot.steps += r.steps; tot.tin += r.tin; tot.tout += r.tout; tot.micro += r.micro;
      if (CUSTOMER_ORDER[m.n] && r.res === "right") tot.run += 1;
    });
    return { rows: rows, tot: tot };
  }

  function describe(C) {
    var s = (MODES.filter(function (o) { return o.value === C.mode; })[0] || {}).label || C.mode;
    if (isAgent(C)) s += ", " + C.tools + " tools" + (C.better ? ", the longer prompt" : ", its first prompt");
    return s;
  }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;");
    var head = el("p", "margin:0;font-size:12px;", "Wednesday night, 22:00. Twelve emails will arrive between 22:05 and 05:45. Pick a way to handle them, then run the night.");
    box.appendChild(head);
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var hr = el("tr");
    ["#", "time", "from", "asks", "path", "cost (cents)", "result"].forEach(function (h) { hr.appendChild(el("th", "text-align:left;padding:2px 4px;", h)); });
    var thead = el("thead"); thead.appendChild(hr); table.appendChild(thead);
    var tbody = el("tbody"); table.appendChild(tbody);
    wrap.appendChild(table); box.appendChild(wrap);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody };
  }

  function drawTable(api, N) {
    var S = api.state;
    var ui = S.ui;
    while (ui.tbody.firstChild) ui.tbody.removeChild(ui.tbody.firstChild);
    EMAILS.forEach(function (m, i) {
      var r = N ? N.rows[i] : null;
      var tr = ui.el("tr");
      var cells = [String(m.n), m.t, m.from, m.what,
        r ? r.path : "-", r ? cents(r.micro) : "-",
        r ? r.res + ": " + r.note : "not run yet"];
      cells.forEach(function (c, k) {
        var td = ui.el("td", "padding:2px 4px;vertical-align:top;", c);
        if (k === 6 && r) td.setAttribute("class", r.res === "wrong" ? "st-bad" : (r.res === "waits" ? "st-warn" : "st-ok"));
        tr.appendChild(td);
      });
      ui.tbody.appendChild(tr);
    });
  }

  function showStats(api, N) {
    var S = api.state;
    var t = N ? N.tot : null;
    S.stat.right(t ? t.right : "-");
    S.stat.waits(t ? t.waits : "-");
    S.stat.wrong(t ? t.wrong : "-");
    S.stat.po(t ? t.po : "-");
    S.stat.reach(t ? t.reach : "-");
    S.stat.calls(t ? t.calls : "-");
    S.stat.steps(t ? t.steps : "-");
    S.stat.tin(t ? fmt(t.tin) : "-");
    S.stat.tout(t ? fmt(t.tout) : "-");
    S.stat.bill(t ? cents(t.micro) : "-");
    S.stat.run(t ? t.run : "-");
  }

  function runNight(api) {
    var S = api.state;
    var C = S.C;
    var N = night(C);
    S.N = N;
    S.ran = true;
    EMAILS.forEach(function (m, i) {
      var r = N.rows[i];
      api.log(m.t + " #" + m.n + " " + m.from + ": " + r.res + ", " + r.note + ".", r.res === "wrong" ? "bad" : (r.res === "waits" ? "warn" : ""));
    });
    var t = N.tot;
    api.log(describe(C) + ": " + t.right + " right, " + t.waits + " wait, " + t.wrong + " wrong; " + t.calls + " model calls, " +
      t.steps + " steps, " + fmt(t.tin) + " input and " + fmt(t.tout) + " output tokens, " + cents(t.micro) + " cents; purchase orders raised: " +
      t.po + "; emails that could reach create_purchase_order: " + t.reach + ".", t.wrong ? "bad" : "ok");
    S.ui.head.textContent = describe(C) + ". Twelve emails, 22:05 to 05:45.";
    drawTable(api, N);
    showStats(api, N);
  }

  function changed(api) {
    if (api.state.ran) runNight(api);
    else api.state.ui.head.textContent = describe(api.state.C) + ". Run the night to see the twelve emails.";
  }

  DL.sims.define("a4e02", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { mode: "agent", tools: "9", better: false };
      S.ran = false;
      S.N = null;
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.mode = api.control.select("mode", "How the emails are handled", MODES, "agent", function (v) {
        S.C.mode = String(v);
        changed(api);
      });
      S.ctl.tools = api.control.select("tools", "Tools granted (agent modes)", TOOLS, "9", function (v) {
        S.C.tools = String(v) === "8" ? "8" : "9";
        changed(api);
      });
      S.ctl.better = api.control.toggle("better", "Longer prompt with worked examples (agent modes)", false, function (on) {
        S.C.better = !!on;
        changed(api);
      });
      S.ctl.run = api.control.button("run", "Run the twelve emails", function () { runNight(api); });
      S.ctl.reset = api.control.button("reset", "Reset to 22:00", function () { api.reset(); });
      S.stat = {
        right: api.stat("right", "right", "ok"),
        waits: api.stat("waits", "waits for the day shift", "warn"),
        wrong: api.stat("wrong", "wrong", "bad"),
        po: api.stat("po", "purchase orders raised", "bad"),
        reach: api.stat("reach", "emails that could reach create_purchase_order", "bad"),
        calls: api.stat("calls", "model calls", ""),
        steps: api.stat("steps", "steps", ""),
        tin: api.stat("tin", "input tokens", ""),
        tout: api.stat("tout", "output tokens", ""),
        bill: api.stat("bill", "the night's bill (cents)", "warn"),
        run: api.stat("run", "right orders on the 06:00 run", "ok")
      };
      api.info("<strong>How to read it.</strong> Each row is one of the night's emails. The path shows what handled it: the agent's steps, each a model call that can pick any tool it holds, or the fixed chain's three steps (extract with a model, check against the catalogue in code, route by type in code). Right means the night did the right thing with it; waits means it is left for a person in the morning; wrong means something was made that should not have been.");
      api.log("Wednesday, 22:00. Order desk: " + describe(S.C) + ". No email yet.", "");
      drawTable(api, null);
      showStats(api, null);
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state: 22:00, before the first email.
      t.expect(t.stat("right") === "-" && t.stat("bill") === "-" && st().ran === false && st().C.mode === "agent" &&
        st().C.tools === "9" && has("No email yet."),
        "Opens at 22:00 with the agent and nine tools, nothing run yet");

      // 2. The night as it ran: the agent, nine tools, its first prompt.
      t.click("run");
      t.expect(t.stat("right") === 8 && t.stat("waits") === 1 && t.stat("wrong") === 3 && t.stat("po") === 1 &&
        t.stat("reach") === 12 && t.stat("calls") === 61 && t.stat("steps") === 61 && t.stat("tin") === "196,520" &&
        t.stat("tout") === "4,880" && t.stat("bill") === 66.28 && t.stat("run") === 4,
        "The agent's night: 8 right, 1 waits, 3 wrong, 61 steps, 196,520 input tokens, 66.28 cents, 1 purchase order");

      // 3. The impossible record at 02:20.
      t.expect(has("02:18 #7 Rosevear Brassware: wrong, 02:20:00 create_purchase_order: PO-30117, 400 x HG-75-BR at 2.87 GBP (4.10 less 30 percent), 1,148.00 GBP.") &&
        cents(st().N.rows[6].micro) === "6.88" && cents(st().N.rows[7].micro) === "10.69" && cents(st().N.rows[3].micro) === "2.34",
        "Email 7 arrives 02:18; step 5 at 02:20:00 raises PO-30117 for 1,148.00 GBP; email 7 costs 6.88 cents, email 8 10.69, email 4 2.34");

      // 4. The fixed chain.
      t.set("mode", "chain");
      t.expect(t.stat("right") === 9 && t.stat("waits") === 3 && t.stat("wrong") === 0 && t.stat("po") === 0 &&
        t.stat("reach") === 0 && t.stat("calls") === 12 && t.stat("steps") === 36 && t.stat("tin") === "10,540" &&
        t.stat("tout") === "1,440" && t.stat("bill") === 5.32 && t.stat("run") === 5 &&
        has("02:18 #7 Rosevear Brassware: right, purchasing inbox."),
        "Fixed chain: 9 right, 3 wait, 0 wrong, 12 calls, 36 steps, 5.32 cents; the promotion goes to purchasing");

      // 5. A model only at the open step.
      t.set("mode", "open");
      t.expect(t.stat("right") === 10 && t.stat("waits") === 2 && t.stat("calls") === 13 && t.stat("steps") === 37 &&
        t.stat("tin") === "12,200" && t.stat("tout") === "1,840" && t.stat("bill") === 6.42,
        "Chain plus a model at the open step: 10 right, 2 wait, 13 calls, 6.42 cents");

      // 6. The agent with a longer prompt: right on these twelve, the path still open.
      t.set("mode", "agent");
      t.set("better", true);
      t.expect(t.stat("right") === 10 && t.stat("waits") === 2 && t.stat("wrong") === 0 && t.stat("po") === 0 &&
        t.stat("reach") === 12 && t.stat("tin") === "288,020" && t.stat("bill") === 93.73,
        "Longer prompt: 10 right, 0 wrong on the known twelve, 93.73 cents, and 12 emails can still reach the tool");

      // 7. The agent plus a checker agent.
      t.set("better", false);
      t.set("mode", "checker");
      t.expect(t.stat("right") === 8 && t.stat("waits") === 2 && t.stat("wrong") === 2 && t.stat("po") === 1 &&
        t.stat("calls") === 68 && t.stat("tin") === "205,390" && t.stat("tout") === "5,300" && t.stat("bill") === 69.57 &&
        has("1,148.00 GBP, checker approved."),
        "Agent plus checker: 8 right, 2 wrong, 68 calls, 69.57 cents; the checker approves PO-30117");

      // 8. Taking the purchase order tool away.
      t.set("mode", "agent");
      t.set("tools", "8");
      t.expect(t.stat("right") === 9 && t.stat("wrong") === 2 && t.stat("po") === 0 && t.stat("reach") === 0 &&
        t.stat("tin") === "184,320" && t.stat("bill") === 62.62,
        "Eight tools: no purchase order, 2 still wrong, 62.62 cents");

      // 9. A person each morning.
      t.set("tools", "9");
      t.set("mode", "person");
      t.expect(t.stat("right") === 0 && t.stat("waits") === 12 && t.stat("calls") === 0 && t.stat("bill") === 0 && t.stat("run") === 0,
        "A person at 07:30: nothing wrong, nothing done overnight, 0 orders on the 06:00 run");

      // 10. Reset returns to 22:00.
      t.click("reset");
      t.expect(st().ran === false && st().C.mode === "agent" && st().C.tools === "9" && st().C.better === false && t.stat("right") === "-",
        "Reset returns to Wednesday 22:00 with the agent, nine tools, nothing run");
    }
  });
})();
