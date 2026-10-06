/* sims/s1e11-v1.0.1.js  (published as sims/s1e11.js)
   Case s1e11 "Logs at 3 AM": a log explorer for the Lantern diner's three services.

   CHANGELOG
   v1.0.1 (2026-10-06) review fixes: the narrator is renamed Otis (Sol was also s1e10's IT man), so
     the opening log line now reads "Otis opens all three logs". Nothing else changes.
   v1.0.0 (2026-10-06) first version: a widget-style sim built inside api.root. A merged stream of
     log lines from the tablets (fixed columns, diner time), the order API (JSON fields, UTC) and the
     kitchen printer (free text, diner time) arrives from 02:58 at 30 times real speed. Filters by
     level, service and any text, a times switch (as written or all in UTC), click-to-read details,
     and "follow this line's request id", which lines up one order's journey. The hidden fault: the
     printer sleeps after 20 idle minutes and needs 8 seconds to wake, the order API waits only 5,
     then drops the ticket with a WARN. Booth 6's 03:07:12 order (req 7f3a) is the first after the
     quiet, so it vanishes. Controls: level, service, times, follow, test, wait, diagnosis, check,
     reset. Stats: lines read, filters used, diagnosis. selfTest covers the stream, the level filter,
     the UTC trap, following 7f3a, the diagnosis check and reproducing the fault with test orders.

   Notes for anyone copying this file:
   - Widget-style sim with no diagram. setup rebuilds the widget on every reset (the engine empties
     api.root first). Anything a person types goes into .value or textContent, never innerHTML.
   - Nothing is precomputed past the clock. Orders sit in one time-sorted queue and are run through
     the printer model only when the clock reaches them, so a test order sent at 03:05 really would
     wake the printer before Booth 6's order. step only looks at the head of the queue.
   - Times are seconds since midnight, diner time. UTC is 4 hours ahead. Only api.rand() is random.
*/
(function () {
  "use strict";

  /* ---------- the night, in numbers (they match the story) ---------- */

  var SPEED = 30;                    // sim seconds per real second: a minute passes in 2 seconds
  var START = hms(2, 58, 0);         // the sim opens at 02:58:00 diner time
  var UTC_AHEAD = 4 * 3600;          // UTC is 4 hours ahead of the diner's clocks
  var DATE = "2026-10-06";           // the order API's UTC date all night (06:30Z to 10:00Z)
  var SLEEP_AFTER = 1200;            // the printer sleeps after 20 minutes without a ticket
  var WAKE = 8;                      // and takes 8 seconds to wake up
  var TIMEOUT = 5;                   // the order API waits 5 seconds for the printer, then gives up
  var PRINT = 0.9;                   // an awake printer prints in under a second
  var BG_START = hms(2, 30, 0);      // background lines start here (before the sim opens)
  var BG_END = hms(6, 0, 0);         // and stop when the shift ends
  var STATS_EVERY = 300;             // the harmless metrics ERROR, every five minutes
  var BEAT_EVERY = 240;              // a tablet heartbeat every four minutes
  var STORY_REQ = "7f3a";
  var LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];
  var BEAT_TABLETS = [3, 7, 1, 5, 8, 2, 6, 4];

  // The night's orders. The last ticket before the quiet prints at 02:41:05, so the printer falls
  // asleep at 03:01:05 and Booth 6's order at 03:07:12 meets it asleep (idle 26 minutes).
  var ORDERS = [
    { at: hms(2, 31, 40), tablet: 2, req: "a1c9", items: 3 },
    { at: hms(2, 36, 18), tablet: 4, req: "3e07", items: 1 },
    { at: hms(2, 41, 4) + 0.1, tablet: 1, req: "9b52", items: 2 },
    { at: hms(3, 7, 12) + 0.3, tablet: 6, req: STORY_REQ, items: 2 },
    { at: hms(3, 9, 40), tablet: 2, req: "c4d1", items: 4 },
    { at: hms(3, 12, 5), tablet: 4, req: "58e6", items: 2 }
  ];

  var COLOR = { DEBUG: "var(--faint)", INFO: "var(--fg)", WARN: "var(--amber)", ERROR: "var(--red)" };

  var DIAGNOSES = [
    { value: "none", label: "Pick one..." },
    { value: "tablet", label: "Booth 6's tablet never sent it" },
    { value: "crash", label: "The order API crashed with a 500" },
    { value: "stats", label: "The 503 ERRORs every 5 minutes broke it" },
    { value: "asleep", label: "Printer asleep; the API gave up after 5 s and dropped it" },
    { value: "paper", label: "The printer ran out of paper" }
  ];

  var VERDICTS = {
    tablet: "Not that. The tablet's line says 201 Created: the order API took the order. Follow 7f3a past the tablet.",
    crash: "Not that. There's no 500 anywhere. The order API answered 201 and kept running all night.",
    stats: "Not that. Those 503 ERRORs fire every five minutes all night while other orders print fine. Loud, but not guilty.",
    paper: "Not that. The printer printed tickets at 03:09:40 and 03:12:05, minutes later, with nobody changing the paper.",
    asleep: "Right. The printer fell asleep at 03:01:05 after 20 idle minutes. Booth 6's order woke it at 03:07:12, the order API waited 5 seconds, wrote a WARN and dropped the ticket at 07:07:17Z, and the printer was ready at 03:07:20 with nothing left to print."
  };

  /* ---------- small helpers ---------- */

  function hms(h, m, s) { return h * 3600 + m * 60 + s; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function pad3(n) { return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function clockText(sec) {
    var s = Math.floor(sec + 1e-6);
    s = ((s % 86400) + 86400) % 86400;
    return pad2(Math.floor(s / 3600)) + ":" + pad2(Math.floor((s % 3600) / 60)) + ":" + pad2(s % 60);
  }
  function localText(t) { return clockText(t); }
  function utcText(t) { return clockText(t + UTC_AHEAD) + "Z"; }
  function isoUtc(t) {
    var whole = Math.floor(t + 1e-6);
    var ms = Math.round((t - whole) * 1000);
    if (ms < 0) ms = 0;
    if (ms > 999) ms = 999;
    return DATE + "T" + clockText(whole + UTC_AHEAD) + "." + pad3(ms) + "Z";
  }

  function levelIndex(level) { return LEVELS.indexOf(level); }

  function mk(t, svc, level, tag, req, msg, extra) {
    return { id: 0, t: t, svc: svc, level: level, tag: tag, req: req || "", msg: msg, extra: extra || null };
  }

  // A line exactly as its service wrote it, or with diner times turned into UTC.
  function rowText(line, utc) {
    if (line.svc === "order-api") {
      var o = { ts: isoUtc(line.t), level: line.level, svc: "order-api" };
      if (line.req) o.req = line.req;
      o.msg = line.msg;
      if (line.extra) {
        for (var k in line.extra) if (has(line.extra, k)) o[k] = line.extra[k];
      }
      return JSON.stringify(o);
    }
    var time = utc ? utcText(line.t) : localText(line.t);
    if (line.svc === "printer") return time + " [" + line.level.toLowerCase() + "] printer: " + line.msg;
    return time + " " + (line.level + "  ").slice(0, 5) + " " + line.svc + "  " + line.msg;
  }

  function formatOf(line) {
    if (line.svc === "order-api") return "JSON fields (structured), times in UTC";
    if (line.svc === "printer") return "free text, diner time";
    return "fixed columns, diner time";
  }

  function serviceGroup(svc) { return svc.indexOf("tablet") === 0 ? "tablets" : svc; }

  /* ---------- the time-sorted queue ---------- */

  function push(S, item) {
    var q = S.queue;
    var i = q.length;
    while (i > 0 && q[i - 1].at > item.at) i--;
    q.splice(i, 0, item);
  }

  function pushLine(S, line) { push(S, { at: line.t, kind: "line", line: line }); }

  function drain(api, until) {
    var S = api.state;
    var guard = 0;
    while (S.queue.length && S.queue[0].at <= until && guard++ < 5000) handle(api, S.queue.shift());
  }

  function handle(api, it) {
    var S = api.state;
    if (it.kind === "line") {
      release(api, it.line);
    } else if (it.kind === "order") {
      runOrder(api, it.order, it.at);
    } else if (it.kind === "sleep") {
      if (it.token === S.printer.token) release(api, mk(it.at, "printer", "INFO", "sleep", "", "no tickets for 20 min, going to sleep"));
    } else if (it.kind === "stats") {
      release(api, mk(it.at, "order-api", "ERROR", "stats", "", "metrics push failed", { status: 503 }));
      if (it.at + STATS_EVERY <= BG_END) push(S, { at: it.at + STATS_EVERY, kind: "stats" });
    } else if (it.kind === "beat") {
      var n = BEAT_TABLETS[it.n % BEAT_TABLETS.length];
      var pct = 35 + Math.floor(api.rand() * 60);
      release(api, mk(it.at, "tablet-" + n, "DEBUG", "beat", "", "heartbeat ok, battery " + pct + "%"));
      if (it.at + BEAT_EVERY <= BG_END) push(S, { at: it.at + BEAT_EVERY, kind: "beat", n: it.n + 1 });
    }
  }

  /* ---------- the printer and the order API ---------- */

  // The printer did something at time `at`: its 20-minute sleep countdown starts again.
  function activity(S, at) {
    var P = S.printer;
    if (at < P.active) return;
    P.active = at;
    P.token += 1;
    push(S, { at: at + SLEEP_AFTER, kind: "sleep", token: P.token });
  }

  function runOrder(api, o, t) {
    var S = api.state;
    var P = S.printer;
    var req = o.req;
    var tab = "tablet-" + o.tablet;
    S.orders[req] = true;

    // The order API answers the tablet at once, before the ticket exists, then calls the printer.
    pushLine(S, mk(t + 0.031, "order-api", "INFO", "accepted", req, "POST /orders", { status: 201, ms: 31 }));
    pushLine(S, mk(t + 0.033, "order-api", "DEBUG", "toprinter", req, "sending ticket to printer", { booth: o.tablet }));
    pushLine(S, mk(t + 0.048, tab, "INFO", "sent", req, "order sent req=" + req + " -> 201 Created (48 ms)"));

    var printAt = -1;
    var asleep = t >= P.active + SLEEP_AFTER && t >= P.readyAt;
    if (asleep) {
      var idle = Math.floor((t - P.active) / 60);
      P.readyAt = t + WAKE;
      pushLine(S, mk(t + 0.08, "printer", "INFO", "job", req, "job " + req + " received. Waking from sleep (idle " + idle + " min)."));
      pushLine(S, mk(P.readyAt, "printer", "INFO", "ready", "", "warm and ready"));
      activity(S, P.readyAt);
      dropped(S, req, t);
    } else if (t < P.readyAt) {
      pushLine(S, mk(t + 0.08, "printer", "INFO", "job", req, "job " + req + " received, still waking up."));
      if (P.readyAt - t > TIMEOUT) dropped(S, req, t);
      else printAt = P.readyAt + PRINT;
    } else {
      printAt = t + PRINT;
    }

    if (printAt >= 0) {
      pushLine(S, mk(printAt, "printer", "INFO", "printed", req,
        "ticket printed for " + req + " (booth " + o.tablet + ", " + o.items + (o.items === 1 ? " item)" : " items)")));
      pushLine(S, mk(printAt + 0.02, "order-api", "INFO", "confirmed", req, "printer confirmed ticket",
        { ms: Math.round((printAt - t - 0.033) * 1000) }));
      activity(S, printAt);
    }

    if (S.live && o.story) api.log(o.story, "");
  }

  function dropped(S, req, t) {
    pushLine(S, mk(t + 0.033 + TIMEOUT, "order-api", "WARN", "dropped", req,
      "printer did not answer in 5000 ms, dropping ticket", { waited_ms: 5000 }));
  }

  /* ---------- the widget (plain DOM inside api.root) ---------- */

  var LABEL = "display:block;color:var(--muted);font-family:var(--f-ui);font-size:11px;letter-spacing:.07em;text-transform:uppercase;margin:0 0 4px;";
  var FIELD = "font-family:var(--f-ui);font-size:13px;color:var(--fg);background:var(--surface-2);border:1px solid var(--line);border-radius:4px;padding:7px 8px;min-width:0;";
  var PANE = "margin:0;padding:10px 12px;background:var(--bg);border:1px solid var(--line);border-radius:4px;font-family:var(--f-ui);font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;color:var(--fg);max-height:260px;overflow:auto;";
  var ROW = "display:block;width:100%;box-sizing:border-box;text-align:left;font-family:var(--f-ui);font-size:12px;line-height:1.45;padding:5px 8px;margin:0;border:0;border-bottom:1px solid var(--line);border-radius:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;cursor:pointer;";

  function buildWidget(api) {
    var S = api.state;
    var doc = api.root.ownerDocument;
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    }

    var box = el("div", "display:grid;gap:10px;padding:10px;min-width:0;");

    var form = el("form", "display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;margin:0;min-width:0;");
    form.setAttribute("role", "search");
    var fwrap = el("div", "flex:1 1 180px;min-width:0;");
    var lab = el("label", LABEL, "Search every line (any text)");
    lab.setAttribute("for", "s1e11-search");
    var input = el("input", FIELD + "width:100%;box-sizing:border-box;");
    input.type = "text";
    input.id = "s1e11-search";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("placeholder", "7f3a, 03:07, printer...");
    fwrap.appendChild(lab);
    fwrap.appendChild(input);
    var go = el("button", null, "Search");
    go.type = "submit";
    go.className = "btn btn-small btn-primary";
    var clear = el("button", null, "Clear");
    clear.type = "button";
    clear.className = "btn btn-small";
    form.appendChild(fwrap);
    form.appendChild(go);
    form.appendChild(clear);
    form.addEventListener("submit", function (e) {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      applySearch(api, input.value);
    });
    clear.addEventListener("click", function () {
      input.value = "";
      applySearch(api, "");
    });

    var status = el("p", "margin:0;font-family:var(--f-ui);font-size:12px;color:var(--muted);", "");
    status.setAttribute("aria-live", "polite");

    var list = el("div", "max-height:320px;overflow-y:auto;border:1px solid var(--line);border-radius:4px;background:var(--bg);min-width:0;");
    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "Log lines, oldest first");
    list.addEventListener("scroll", function () {
      S.stick = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
    });

    var grid = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;min-width:0;");
    var dwrap = el("div", "min-width:0;");
    dwrap.appendChild(el("p", LABEL, "The line you picked"));
    var details = el("pre", PANE, "Click a line, or Tab to it and press Enter, to read it here.");
    details.setAttribute("tabindex", "0");
    dwrap.appendChild(details);
    var jwrap = el("div", "min-width:0;");
    jwrap.appendChild(el("p", LABEL, "One order's journey (all times in UTC)"));
    var journey = el("div", PANE, "Pick a line with a request id (req), then press Follow.");
    journey.setAttribute("aria-live", "polite");
    journey.setAttribute("tabindex", "0");
    jwrap.appendChild(journey);
    grid.appendChild(dwrap);
    grid.appendChild(jwrap);

    box.appendChild(form);
    box.appendChild(status);
    box.appendChild(list);
    box.appendChild(grid);
    api.root.appendChild(box);
    return { el: el, form: form, search: input, status: status, list: list, details: details, journey: journey };
  }

  function matches(S, line) {
    if (levelIndex(line.level) < S.minLevel) return false;
    if (S.svc !== "all" && serviceGroup(line.svc) !== S.svc) return false;
    if (S.term && rowText(line, S.utc).toLowerCase().indexOf(S.term) < 0) return false;
    return true;
  }

  function rowEl(api, line) {
    var S = api.state;
    var b = api.root.ownerDocument.createElement("button");
    b.type = "button";
    b.setAttribute("data-line", String(line.id));
    paintRow(S, b, line);
    b.textContent = rowText(line, S.utc);
    b.addEventListener("click", function () { select(api, line.id); });
    return b;
  }

  function paintRow(S, b, line) {
    var on = S.selected === line.id;
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("style", ROW + "color:" + COLOR[line.level] + ";background:" + (on ? "var(--surface-2)" : "none") + ";");
  }

  function renderList(api) {
    var S = api.state;
    var list = S.ui.list;
    while (list.firstChild) list.removeChild(list.firstChild);
    S.view = [];
    S.rowEls = {};
    S.empty = null;
    for (var i = 0; i < S.lines.length; i++) {
      if (matches(S, S.lines[i])) addRow(api, S.lines[i]);
    }
    if (!S.view.length) {
      S.empty = S.ui.el("p", "margin:0;padding:10px;color:var(--muted);font-size:12px;", "No lines match these filters.");
      list.appendChild(S.empty);
    }
    updateStatus(api);
    if (S.stick) list.scrollTop = list.scrollHeight;
  }

  function addRow(api, line) {
    var S = api.state;
    if (S.empty && S.empty.parentNode) S.empty.parentNode.removeChild(S.empty);
    S.empty = null;
    var b = rowEl(api, line);
    S.view.push(line.id);
    S.rowEls[line.id] = b;
    S.ui.list.appendChild(b);
  }

  function updateStatus(api) {
    var S = api.state;
    S.ui.status.textContent = "Showing " + S.view.length + " of " + S.lines.length + " lines" +
      (S.minLevel > 0 ? ", " + LEVELS[S.minLevel] + " and up" : "") +
      (S.svc !== "all" ? ", " + S.svc + " only" : "") +
      (S.term ? ", matching \"" + S.term + "\"" : "") +
      (S.utc ? ", times in UTC" : ", times as written") + ".";
  }

  // A new line arrives from the stream.
  function release(api, line) {
    var S = api.state;
    line.id = S.lines.length + 1;
    S.lines.push(line);
    if (!S.live) return;
    if (matches(S, line)) addRow(api, line);
    updateStatus(api);
    if (S.stick) S.ui.list.scrollTop = S.ui.list.scrollHeight;
  }

  /* ---------- reading, filtering, following ---------- */

  function markRead(S, id) {
    if (S.read[id]) return;
    S.read[id] = true;
    S.readCount += 1;
  }

  function updateStats(api) {
    var S = api.state;
    S.stat.read(S.readCount);
    S.stat.filters(S.filters);
    S.stat.diag(S.result);
  }

  function select(api, id) {
    var S = api.state;
    var line = S.lines[id - 1];
    if (!line) return;
    var prev = S.selected;
    S.selected = id;
    if (prev && S.rowEls[prev]) paintRow(S, S.rowEls[prev], S.lines[prev - 1]);
    if (S.rowEls[id]) paintRow(S, S.rowEls[id], line);
    S.ui.details.textContent =
      "Written as:  " + rowText(line, false) + "\n\n" +
      "Diner time:  " + localText(line.t) + "\n" +
      "UTC:         " + utcText(line.t) + "\n" +
      "Service:     " + line.svc + "\n" +
      "Level:       " + line.level + "\n" +
      "Request id:  " + (line.req || "(none on this line)") + "\n" +
      "Format:      " + formatOf(line);
    markRead(S, id);
    updateStats(api);
  }

  function applySearch(api, raw) {
    var S = api.state;
    var term = String(raw === undefined || raw === null ? "" : raw).trim().toLowerCase();
    if (term && term !== S.term) S.filters += 1;
    S.term = term;
    renderList(api);
    updateStats(api);
    api.log(term ? "Searched for \"" + term + "\": " + S.view.length + " lines match." : "Search cleared. " + S.view.length + " lines shown.", "");
  }

  function follow(api) {
    var S = api.state;
    var line = S.selected ? S.lines[S.selected - 1] : null;
    if (!line) { api.log("Click a line first, then follow its request id.", "warn"); return; }
    if (!line.req) { api.log("That line has no request id. Pick a line about an order, one with req in it.", "warn"); return; }
    var req = line.req;
    var trail = S.lines.filter(function (l) { return l.req === req; });
    var services = {};
    trail.forEach(function (l) { markRead(S, l.id); services[serviceGroup(l.svc)] = true; });
    var printed = trail.some(function (l) { return l.tag === "printed"; });
    var lost = trail.some(function (l) { return l.tag === "dropped"; });
    var summary, tone;
    if (printed) {
      summary = "The trail ends with a printed ticket. This order made it to the kitchen.";
      tone = "ok";
    } else if (lost) {
      summary = "The trail ends at the order API's WARN: it waited 5 seconds for the printer, then dropped the ticket. There is no \"ticket printed\" line for " + req + " anywhere.";
      tone = "bad";
    } else {
      summary = "No ending yet. Give the stream a few seconds and follow it again.";
      tone = "warn";
    }
    var J = S.ui.journey;
    while (J.firstChild) J.removeChild(J.firstChild);
    var ol = S.ui.el("ol", "margin:0 0 8px;padding-left:20px;display:grid;gap:4px;");
    trail.forEach(function (l) { ol.appendChild(S.ui.el("li", "color:" + COLOR[l.level] + ";", rowText(l, true))); });
    J.appendChild(S.ui.el("p", "margin:0 0 6px;color:var(--amber);", "req " + req + ": " + trail.length + " lines, from " + Object.keys(services).join(", ") + "."));
    J.appendChild(ol);
    J.appendChild(S.ui.el("p", "margin:0;", summary));
    updateStats(api);
    api.log("Followed " + req + " through " + Object.keys(services).length + " services. " + summary, tone);
  }

  function newReq(api) {
    var S = api.state;
    for (var i = 0; i < 50; i++) {
      var r = ("000" + Math.floor(api.rand() * 65536).toString(16)).slice(-4);
      if (!S.orders[r]) return r;
    }
    return "t" + (S.tests + 1) + "x";
  }

  function testOrder(api) {
    var S = api.state;
    drain(api, api.clock);
    var req = newReq(api);
    var t = api.clock;
    S.tests += 1;
    S.lastTest = req;
    runOrder(api, { tablet: 6, req: req, items: 1 }, t);
    api.log("Test order " + req + " sent from Booth 6 at " + localText(t) + " diner time. Watch for its lines, or search " + req + ".", "");
  }

  // Jump ahead until the kitchen has had 20 quiet minutes since the printer last did anything.
  function waitQuiet(api) {
    var S = api.state;
    var target = api.clock;
    for (var i = 0; i < 6; i++) {
      var want = Math.max(api.clock, S.printer.active) + SLEEP_AFTER + 30;
      if (want > target) target = want;
      drain(api, target);
      if (S.printer.active + SLEEP_AFTER + 30 <= target) break;
    }
    api.clock = target;
    api.log("Twenty quiet minutes pass. The printer's last ticket or wake-up was at " + localText(S.printer.active) +
      ". It's now " + localText(target) + " at the diner.", "");
  }

  function check(api) {
    var S = api.state;
    var v = String(S.ctl.diag.value || "none");
    if (v === "none" || !has(VERDICTS, v)) { api.log("Pick a diagnosis first.", "warn"); return; }
    S.result = v === "asleep" ? "right" : "wrong";
    updateStats(api);
    api.log(VERDICTS[v], v === "asleep" ? "ok" : "bad");
  }

  function levelLabel(S) { return S.minLevel === 0 ? "every level" : LEVELS[S.minLevel] + (S.minLevel === 3 ? " only" : " and up"); }

  /* ---------- the module ---------- */

  DL.sims.define("s1e11", {
    startClock: START,
    speed: SPEED,

    setup: function (api) {
      var S = api.state;
      api.speed = SPEED;
      S.queue = [];
      S.lines = [];
      S.view = [];
      S.rowEls = {};
      S.empty = null;
      S.read = {};
      S.readCount = 0;
      S.filters = 0;
      S.result = "not yet";
      S.orders = {};
      S.tests = 0;
      S.lastTest = "";
      S.selected = 0;
      S.minLevel = 0;
      S.svc = "all";
      S.term = "";
      S.utc = false;
      S.stick = true;
      S.live = false;
      S.printer = { active: -1e9, readyAt: -1e9, token: 0 };

      S.ui = buildWidget(api);

      // Everything that will happen tonight, in time order. Lines before 02:58 are replayed now.
      activity(S, hms(2, 29, 0));
      ORDERS.forEach(function (o) {
        var copy = { tablet: o.tablet, req: o.req, items: o.items };
        if (o.req === STORY_REQ) copy.story = "03:07:12. Booth 6 is the first order since 02:41. Pearl taps in black coffee and lemon pie.";
        push(S, { at: o.at, kind: "order", order: copy });
      });
      push(S, { at: BG_START + 0.002, kind: "stats" });
      push(S, { at: BG_START + 40, kind: "beat", n: 0 });
      pushLine(S, mk(hms(2, 52, 30), "tablet-8", "WARN", "battery", "", "battery low (14%)"));
      drain(api, START);
      S.live = true;

      S.ctl = {};
      S.ctl.level = api.control.select("level", "Show levels", [
        { value: "DEBUG", label: "Every level (DEBUG and up)" },
        { value: "INFO", label: "INFO and up" },
        { value: "WARN", label: "WARN and up" },
        { value: "ERROR", label: "ERROR only" }
      ], "DEBUG", function (v) {
        var i = levelIndex(String(v));
        if (i < 0) return;
        S.minLevel = i;
        if (i > 0) S.filters += 1;
        renderList(api);
        updateStats(api);
        api.log("Showing " + levelLabel(S) + ": " + S.view.length + " of " + S.lines.length + " lines.", "");
      });
      S.ctl.svc = api.control.select("service", "Service", [
        { value: "all", label: "All three services" },
        { value: "tablets", label: "Tablets" },
        { value: "order-api", label: "Order API" },
        { value: "printer", label: "Kitchen printer" }
      ], "all", function (v) {
        S.svc = String(v);
        if (S.svc !== "all") S.filters += 1;
        renderList(api);
        updateStats(api);
        api.log("Service: " + (S.svc === "all" ? "all three" : S.svc) + ". " + S.view.length + " lines shown.", "");
      });
      S.ctl.times = api.control.select("times", "Times", [
        { value: "written", label: "As each service wrote them" },
        { value: "utc", label: "All in UTC" }
      ], "written", function (v) {
        S.utc = String(v) === "utc";
        if (S.utc) S.filters += 1;
        renderList(api);
        updateStats(api);
        api.log(S.utc
          ? "Every time is now shown in UTC, like the order API's. 03:07 at the diner reads 07:07Z."
          : "Times are back to how each service wrote them: tablets and printer in diner time, the order API in UTC.", "");
      });
      S.ctl.follow = api.control.button("follow", "Follow this line's request id", function () { follow(api); }, { tone: "primary", wide: true });
      S.ctl.test = api.control.button("test", "Send a test order from Booth 6", function () { testOrder(api); });
      S.ctl.wait = api.control.button("wait", "Let 20 quiet minutes pass", function () { waitQuiet(api); });
      S.ctl.diag = api.control.select("diagnosis", "My diagnosis", DIAGNOSES, "none", function () {});
      S.ctl.check = api.control.button("check", "Check my diagnosis", function () { check(api); }, { wide: true });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        read: api.stat("read", "lines read", ""),
        filters: api.stat("filters", "filters used", ""),
        diag: api.stat("diagnosis", "diagnosis", "")
      };
      updateStats(api);
      renderList(api);

      api.info("<strong>How to read this.</strong> Each service keeps its own log. The tablets write fixed columns and the printer writes free text, both in diner time. The order API writes JSON fields, in UTC. Click any line to read it. A line with a request id (req) can be followed.");
      api.log("02:58 at the Lantern. Otis opens all three logs. New lines stream in, 30 times faster than real life.", "");
    },

    step: function (api) {
      if (api.state.queue) drain(api, api.clock);
    },

    selfTest: async function (t) {
      var S = t.api.state;
      var root = t.api.root;
      var doc = root.ownerDocument;
      function fire(el, type) {
        var e = doc.createEvent("Event");
        e.initEvent(type, true, true);
        el.dispatchEvent(e);
      }
      function search(term) { S.ui.search.value = term; fire(S.ui.form, "submit"); }
      function shown() { return S.view.map(function (id) { return S.lines[id - 1]; }); }
      function find(req, tag) {
        for (var i = 0; i < S.lines.length; i++) if (S.lines[i].req === req && S.lines[i].tag === tag) return S.lines[i];
        return null;
      }
      function n(id) { return Number(t.stat(id)); }

      // 1. The stream reaches 03:08:30 and the story's order ends in a WARN, never a ticket.
      await t.run(21);
      var drop = find(STORY_REQ, "dropped");
      var groups = {};
      S.lines.forEach(function (l) { groups[serviceGroup(l.svc)] = true; });
      t.expect(!!drop && rowText(drop, false).indexOf("dropping ticket") >= 0 && !find(STORY_REQ, "printed") &&
        groups.tablets && groups["order-api"] && groups.printer,
        "by 03:08 all three services have logged, and order 7f3a ends in the order API's WARN with no ticket printed");

      // 2. The level filter shows only WARN and up, and counts as a filter used.
      t.set("level", "WARN");
      var list = shown();
      t.expect(list.length > 0 && list.length < S.lines.length &&
        list.every(function (l) { return levelIndex(l.level) >= 2; }) && n("filters") === 1,
        "WARN and up hides DEBUG and INFO lines, and the filters-used stat counts it");

      // 3. The UTC trap: the order API never wrote 03:07.
      t.set("level", "DEBUG");
      search("03:07");
      list = shown();
      t.expect(list.length >= 2 && list.every(function (l) { return l.svc !== "order-api"; }),
        "searching 03:07 finds tablet and printer lines but nothing from the order API, which writes UTC");

      // 4. With every time in UTC, 07:07 finds the tablet's line and the order API's lines together.
      t.set("times", "utc");
      search("07:07");
      list = shown();
      t.expect(list.some(function (l) { return l.svc === "order-api"; }) && list.some(function (l) { return l.svc === "tablet-6"; }),
        "with all times in UTC, one search for 07:07 lines up the tablet and the order API");

      // 5. Following the request id lines up the journey and counts the lines read.
      search("");
      var sent = find(STORY_REQ, "sent");
      var row = sent ? root.querySelector('[data-line="' + sent.id + '"]') : null;
      if (row) fire(row, "click");
      t.click("follow");
      var jt = S.ui.journey.textContent;
      t.expect(!!row && jt.indexOf("\"status\":201") >= 0 && jt.indexOf("dropping ticket") >= 0 && jt.indexOf("tablet-6") >= 0 && n("read") >= 5,
        "following 7f3a lines up its 5 lines: the tablet's 201, the order API's lines and the WARN where it ends");

      // 6. The diagnosis check.
      t.set("diagnosis", "stats");
      t.click("check");
      var first = t.stat("diagnosis");
      t.set("diagnosis", "asleep");
      t.click("check");
      t.expect(first === "wrong" && t.stat("diagnosis") === "right",
        "blaming the noisy 503 ERRORs is marked wrong; the sleeping printer and 5-second timeout is right");

      // 7. Reproduce it: after 20 quiet minutes a test order vanishes, and the very next one prints.
      t.click("wait");
      t.click("test");
      var r1 = S.lastTest;
      await t.run(0.5);
      var gone = !!find(r1, "dropped") && !find(r1, "printed");
      t.click("test");
      var r2 = S.lastTest;
      await t.run(0.3);
      t.expect(gone && r2 !== r1 && !!find(r2, "printed") && !find(r2, "dropped"),
        "after 20 quiet minutes a test order is dropped like Booth 6's, and a second one right after prints");
    }
  });
})();
