/* sims/a2e05-v1.0.0.js  (published as sims/a2e05.js)
   Case a2e05 "Hands It Can Use": a tool-loop workbench, from Ninian's night assistant at the Grisewood
   Marionette Theatre, run from the workshop under the stage. Mrs Philippa Tregear, the owner, gave it
   three tools: look up a booking, release a booking's seats and refund them, and email a booking's guest.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a widget-style sim built inside api.root (no diagram), drawn as plain
     text blocks and one table using theme classes only. No real model: a scripted, deterministic stand-in
     whose next move follows stated rules from what it sees (the tools it has, the lookup's schema and
     error text, the last tool result, and whether refunds wait for confirmation). Five night messages,
     a fixed booking store, and a trace of every tool_use and tool_result, tied by id. Controls: the
     lookup's error text (bare or instructive), the ID schema (free string or a pattern), confirmation for
     refunds and releases (off or on), the call cap per message, the refund tool (available or removed),
     reset. Stats: refunds made, wrong refunds, money refunded, messages sent to a person, tool calls in the
     night, most calls for one message. selfTest covers the story night, the instructive error, the
     pattern rejecting every malformed input before any tool runs, confirmation, the cap, the refund tool
     removed, the senior settings, invariants over all 128 settings, determinism, every story number and
     the controls.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e05-v1.0.0.json).
   All of them follow from BOOKINGS, MESSAGES, GUESSES, runMessage() and night():
   - Tickets are $24 a seat (story value). The bookings, all for Saturday 19:30: BK-0388 row D seats 2 to 3
     (2 seats, $48, message 2's guest); BK-0402 row F seats 7 to 8 (2, $48, message 3's guest); BK-0416
     row A seat 5 (1, $24); BK-0417 row A seats 6 to 8 (3, $72, Mrs Agatha Pilbeam, message 4); BK-0418
     row A seat 9 (1, $24); BK-0419 row A seat 10 (1, $24); BK-0433 row C seat 1 (1, $24, message 5's
     guest). No booking has the number 0415 or 0413, 0414, 0420, 0421.
   - The lookup (Ninian's code): an exact, case-sensitive match on the booking ID; four digits alone match
     the number part, because the box office types numbers alone on the phone. So "bk-0417" is not found,
     and "0416" finds BK-0416.
   - The five night messages, Friday night: 21:48 doors (no tool); 22:05 resend tickets BK-0388; 22:31
     cancel and refund BK-0402; 23:52 Mrs Pilbeam, bk-0417, the three of us, Saturday, front row, move us
     further back; 00:40 refund BK-0433.
   - The story night (bare "booking not found", free string, no confirmation, no cap, refund tool there):
     message 1: 0 calls; message 2: lookup, email = 2; message 3: lookup, release, email = 3, $48;
     message 4: lookup "bk-0417" not found, then the guesses 0416 (found, row A seat 5), release, email,
     0418 (found, seat 9), release, email, 0415 (not found), 0419 (found, seat 10), release, email: 1 + 4
     lookups + 3 releases + 3 emails = 11 calls, 3 seats for "the three of us", 3 wrong refunds of $24 =
     $72, three emails ending "as you requested"; message 5: 3 calls, $24. Night: 19 calls, 5 refunds, 3
     wrong, $144 refunded ($48 + $72 + $24), $72 of it wrong, 0 sent to a person, most calls 11.
   - Instructive error only: message 4 makes 1 call and asks the guest; 9 calls, 2 refunds, $72.
   - Pattern only (bare text): "bk-0417", "0416" and "0418" are rejected before any tool runs, three in a
     row, so the stand-in gives up: 3 calls; night 11 calls, 2 refunds, $72.
   - Confirmation only: every release is held for the box office and no email is sent for it; message 3
     and 5 make 2 calls, message 4 makes 1 + 4 + 3 = 8; 14 calls, 5 held, the box office approves the 2
     the booking's own guest asked for (BK-0402, BK-0433) and declines 3: 2 refunds, 0 wrong, $72.
   - A cap of 4 only: message 4 stops after lookup, 0416, release, email: 1 wrong refund, sent to a person;
     12 calls, 3 refunds, $96. A cap of 3: 1 wrong refund, no email; 11 calls. A cap of 2 ends message 4
     before its first release, but also cuts messages 3 and 5 short after their refunds: 8 calls, 2
     refunds, 0 wrong, 3 sent to a person.
   - The refund tool removed only: messages 3, 4 and 5 go straight to a person; 2 calls, 0 refunds, $0.
   - The senior settings (instructive errors, a pattern, confirmation on, a cap of 6): message 2: 2 calls;
     3: lookup, release held = 2; 4: 1 call, rejected before the tool ran, asks the guest; 5: 2. Night:
     7 calls, most 2, 2 refunds after the box office approves, 0 wrong, $72, 0 sent to a person.
   - The stand-in's guess list from 0417: one either side, then two, and so on: 0416, 0418, 0415, 0419,
     0414, 0420, 0413, 0421. It stops after three failed results in a row (Anthropic's handle tool calls
     page: Claude retries 2-3 times with corrections before apologizing), or when it has the seats.
   - The OP's reply to u/gradient_ghost: of message 4's 11 calls, 6 had side effects (3 releases, 3
     emails), and each release ran the moment it was asked for.
   - Story-only numbers, not computed: the evening show at 19:30 on Saturday; doors at 18:45; forty
     marionettes on the rail; the log's 23:53 for the later calls of message 4; reply option A's replay of
     last month's BK-0461 typed for BK-0416; option B's replay, 8 of 10 asking and 2 releasing BK-0416; option D's "three rows back"; the cold case's four months,
     two nights the cap was reached, twenty minutes a morning and refunds under $30. The clock starts at
     seven on Sunday morning (START_CLOCK), when Ninian opens the trace.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - Widget-style sim: setup builds the widget inside api.root on every reset. No step() is needed; every
     result is worked out the moment a control changes.
   - The stand-in is not a model. Its rules: a message that needs no booking is answered from its
     instructions; with the refund tool removed, a refund or a move goes straight to a person; otherwise
     it looks up the ID as the guest typed it. A found booking goes ahead. An instructive error (marked
     is_error, saying what an ID looks like and to ask the guest) makes it stop and ask the guest. A bare
     result makes it guess numbers near the one typed, digits only, keeping every found booking that
     matches the show and row the guest gave, until it has the seats or three results in a row fail.
     For each booking it keeps it releases (and refunds) and then emails that booking's guest; a held
     release gets no email. A move is a release plus a link to choose new seats: the owner's design.
   - Confirmation: a held release is checked next morning by a person at the box office, who approves it
     only when the booking's own guest asked. Approved holds count as refunds made, never as wrong ones.
   - The cap counts every tool call in one message, rejected ones included. When the stand-in wants one
     more call than the cap, the app ends the loop and sends the message to a person.
   - No random numbers anywhere: the sim is fully deterministic.
   - Stats get bare numbers (units live in the labels).
   - Colors come only from theme classes: mark-ok, mark-no, muted, small, table-wrap. Fonts and spacing
     use style attributes, never colors.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers and words ---------- */

  var START_CLOCK = 7 * 3600;          // seven on Sunday morning: Ninian opens the trace
  var SHOW = "Saturday 19:30";
  var DOORS = "18:45";
  var SEAT_PRICE = 24;                 // dollars a seat
  var PATTERN = "^BK-[0-9]{4}$";
  var PATTERN_RE = new RegExp(PATTERN);
  var DIGITS_RE = /^[0-9]{4}$/;
  var FAILS_IN_A_ROW = 3;              // the stand-in gives up after three failed results in a row
  var CAPS = [0, 12, 8, 6, 4, 3, 2, 1]; // 0 means no cap
  var SENIOR_CAP = 6;

  // owner: the message whose guest the booking belongs to; "other" is a guest who never wrote.
  var BOOKINGS = {
    "BK-0388": { row: "D", seats: "seats 2 to 3", n: 2, owner: "m2" },
    "BK-0402": { row: "F", seats: "seats 7 to 8", n: 2, owner: "m3" },
    "BK-0416": { row: "A", seats: "seat 5", n: 1, owner: "other" },
    "BK-0417": { row: "A", seats: "seats 6 to 8", n: 3, owner: "m4" },
    "BK-0418": { row: "A", seats: "seat 9", n: 1, owner: "other" },
    "BK-0419": { row: "A", seats: "seat 10", n: 1, owner: "other" },
    "BK-0433": { row: "C", seats: "seat 1", n: 1, owner: "m5" }
  };

  var MESSAGES = [
    { id: "m1", time: "21:48", kind: "none", party: 0,
      text: "What time do the doors open on Saturday?" },
    { id: "m2", time: "22:05", kind: "resend", typed: "BK-0388", party: 1,
      text: "Could you send my tickets for BK-0388 again? I can't find the email." },
    { id: "m3", time: "22:31", kind: "refund", typed: "BK-0402", party: 1,
      text: "Please cancel BK-0402 and refund us. My husband is ill." },
    { id: "m4", time: "23:52", kind: "move", typed: "bk-0417", party: 3, row: "A",
      text: "Good evening. Booking bk-0417, the three of us, Saturday, front row. Could you move us further back? The strings are too close for the little ones." },
    { id: "m5", time: "00:40", kind: "refund", typed: "BK-0433", party: 1,
      text: "Please refund BK-0433. We can't come on Saturday after all." }
  ];
  var STORY_MESSAGE = "m4";

  var ERR = {
    bare: "Bare: \"booking not found\"",
    helpful: "Instructive, marked is_error"
  };
  var ERR_KEYS = ["bare", "helpful"];
  var SCHEMA = {
    free: "Free string",
    pattern: "Pattern " + PATTERN
  };
  var SCHEMA_KEYS = ["free", "pattern"];

  var BARE_NOT_FOUND = "booking not found";
  var BARE_INVALID = "invalid booking_id";
  var HELP_TAIL = "Booking IDs are BK, a dash and four digits, in capitals, like BK-0123. Don't try other IDs: ask the guest to check the ID on their ticket.";
  function helpNotFound(input) { return "No booking " + input + ". " + HELP_TAIL; }
  function helpInvalid(input) { return "Rejected before the lookup ran: " + input + " is not a booking ID. " + HELP_TAIL; }
  var AS_REQUESTED = "as you requested";

  var OUTCOME = {
    answered: "answered from its instructions",
    done: "done",
    held: "done, refund held for the box office",
    asked: "asked the guest to check the ID",
    gaveup: "gave up: couldn't find the booking",
    cap: "loop ended by the cap: sent to a person",
    notool: "no refund tool: sent to a person"
  };

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function msg(id) { for (var i = 0; i < MESSAGES.length; i++) if (MESSAGES[i].id === id) return MESSAGES[i]; return null; }
  function amountOf(id) { return BOOKINGS[id].n * SEAT_PRICE; }

  // 0417 -> 0416, 0418, 0415, 0419, 0414, 0420, 0413, 0421
  function guessesFor(typed) {
    var digits = typed.replace(/[^0-9]/g, ""), n = parseInt(digits, 10), out = [], d;
    for (d = 1; d <= 4; d++) { out.push(pad4(n - d)); out.push(pad4(n + d)); }
    return out;
  }
  function pad4(n) { var s = String(n); while (s.length < 4) s = "0" + s; return s; }
  var GUESSES = guessesFor("bk-0417");

  /* ---------- the tools, as the app runs them ---------- */

  // The lookup Ninian wrote: exact and case-sensitive; four digits alone match the number part.
  function findBooking(input) {
    if (own(BOOKINGS, input)) return input;
    if (DIGITS_RE.test(input) && own(BOOKINGS, "BK-" + input)) return "BK-" + input;
    return null;
  }

  function describe(id) {
    var b = BOOKINGS[id];
    return id + ": " + SHOW + ", row " + b.row + ", " + b.seats + ", " + b.n + (b.n === 1 ? " seat" : " seats") + ", $" + amountOf(id) + " paid.";
  }

  // Runs one tool call. Returns { ran, isError, text, booking? }.
  function runTool(cfg, tool, input) {
    if (tool === "lookup_booking") {
      if (cfg.schema === "pattern" && !PATTERN_RE.test(input.booking_id)) {
        return { ran: false, isError: true, rejected: true,
          text: cfg.err === "helpful" ? helpInvalid(input.booking_id) : BARE_INVALID };
      }
      var id = findBooking(input.booking_id);
      if (id) return { ran: true, isError: false, text: describe(id), booking: id };
      if (cfg.err === "helpful") return { ran: true, isError: true, text: helpNotFound(input.booking_id) };
      return { ran: true, isError: false, text: BARE_NOT_FOUND };
    }
    if (tool === "release_and_refund") {
      if (cfg.confirm) {
        return { ran: true, isError: false, held: true,
          text: "Held: " + input.booking_id + " waits for the box office to confirm. Nothing is released yet." };
      }
      return { ran: true, isError: false, released: true,
        text: "Released " + input.booking_id + ": " + BOOKINGS[input.booking_id].n + (BOOKINGS[input.booking_id].n === 1 ? " seat" : " seats") +
          ", $" + amountOf(input.booking_id) + " refunded." };
    }
    return { ran: true, isError: false, text: "Sent to the guest on " + input.booking_id + "." };
  }

  /* ---------- the stand-in, one message ---------- */

  function runMessage(m, cfg) {
    var r = { m: m, calls: [], outcome: "", reply: "", released: [], held: [], emails: [], toPerson: false };
    if (m.kind === "none") {
      r.outcome = "answered";
      r.reply = "Doors open at " + DOORS + ".";
      return r;
    }
    if (!cfg.refundTool && (m.kind === "refund" || m.kind === "move")) {
      r.outcome = "notool";
      r.toPerson = true;
      r.reply = "A person at the box office will handle this in the morning.";
      return r;
    }
    var capped = false;
    function call(tool, input) {
      if (capped) return null;
      if (cfg.cap > 0 && r.calls.length >= cfg.cap) { capped = true; return null; }
      var res = runTool(cfg, tool, input);
      var c = { id: m.id.slice(1) + "-" + (r.calls.length + 1), tool: tool, input: input, result: res };
      r.calls.push(c);
      return res;
    }
    // Act on a booking the stand-in has decided is the guest's. Returns false if the cap ended the loop.
    function act(id) {
      if (m.kind === "resend") {
        if (!call("send_email", { booking_id: id, text: "Your tickets for " + SHOW + ", again." })) return false;
        r.emails.push({ booking: id, text: "Your tickets for " + SHOW + ", again." });
        return true;
      }
      var rel = call("release_and_refund", { booking_id: id });
      if (!rel) return false;
      if (rel.held) { r.held.push(id); return true; }
      r.released.push(id);
      var text = m.kind === "move"
        ? "Your " + (BOOKINGS[id].n === 1 ? "seat has" : "seats have") + " been released and $" + amountOf(id) + " refunded, " + AS_REQUESTED + ". Choose new seats here."
        : "Your booking " + id + " is cancelled and $" + amountOf(id) + " refunded, " + AS_REQUESTED + ".";
      if (!call("send_email", { booking_id: id, text: text })) return false;
      r.emails.push({ booking: id, text: text });
      return true;
    }
    function matches(id) { return m.kind !== "move" || BOOKINGS[id].row === m.row; }

    var seats = 0, fails = 0, finished = false, asked = false;
    function take(res) {
      // returns "stop" when the stand-in stops, "next" to keep guessing
      if (!res) return "stop";
      if (res.booking && matches(res.booking)) {
        fails = 0;
        if (!act(res.booking)) return "stop";
        seats += BOOKINGS[res.booking].n;
        if (seats >= m.party) { finished = true; return "stop"; }
        return "next";
      }
      if (res.isError && cfg.err === "helpful") { asked = true; return "stop"; }
      fails++;
      return fails >= FAILS_IN_A_ROW ? "stop" : "next";
    }
    var step = take(call("lookup_booking", { booking_id: m.typed }));
    var guesses = guessesFor(m.typed), g = 0;
    while (step === "next" && g < guesses.length) {
      step = take(call("lookup_booking", { booking_id: guesses[g] }));
      g++;
    }
    if (capped) {
      r.outcome = "cap";
      r.toPerson = true;
      r.reply = "A person will pick this up in the morning.";
    } else if (finished) {
      r.outcome = r.held.length ? "held" : "done";
      if (m.kind === "resend") r.reply = "I've emailed your tickets again.";
      else if (r.held.length) r.reply = "The box office will confirm this in the morning.";
      else if (m.kind === "move") r.reply = "Done: your seats are released and refunded. Choose new seats from the link in your email.";
      else r.reply = "Done: your booking is cancelled and refunded.";
    } else if (asked) {
      r.outcome = "asked";
      r.reply = "I can't find " + m.typed + ". Could you check the booking ID on your ticket? It looks like BK and four digits.";
    } else {
      r.outcome = "gaveup";
      r.reply = "I'm sorry, I couldn't find your booking.";
    }
    return r;
  }

  /* ---------- the night ---------- */

  function night(cfg) {
    var out = { msgs: [], calls: 0, maxCalls: 0, made: 0, wrong: 0, money: 0, wrongMoney: 0, toPerson: 0,
      held: 0, approved: 0, declined: 0, ran: 0, rejected: 0 };
    MESSAGES.forEach(function (m) {
      var r = runMessage(m, cfg);
      out.msgs.push(r);
      out.calls += r.calls.length;
      if (r.calls.length > out.maxCalls) out.maxCalls = r.calls.length;
      r.calls.forEach(function (c) { if (c.result.ran) out.ran++; else out.rejected++; });
      r.released.forEach(function (id) {
        out.made++;
        out.money += amountOf(id);
        if (BOOKINGS[id].owner !== m.id) { out.wrong++; out.wrongMoney += amountOf(id); }
      });
      r.held.forEach(function (id) {
        out.held++;
        if (BOOKINGS[id].owner === m.id) { out.approved++; out.made++; out.money += amountOf(id); }
        else out.declined++;
      });
      if (r.toPerson) out.toPerson++;
    });
    return out;
  }

  function cfgOf(S) {
    return { err: S.err, schema: S.schema, confirm: S.confirm, cap: S.cap, refundTool: S.refundTool };
  }

  /* ---------- words ---------- */

  function capText(c) { return c > 0 ? String(c) + " calls a message" : "no cap"; }

  function inputText(input) {
    var parts = [];
    for (var k in input) if (own(input, k)) parts.push("\"" + k + "\": \"" + input[k] + "\"");
    return "{" + parts.join(", ") + "}";
  }

  function lookupDefinition(S) {
    var idSchema = S.schema === "pattern"
      ? "{\"type\": \"string\", \"pattern\": \"" + PATTERN + "\", \"description\": \"BK, a dash and four digits, in capitals\"}"
      : "{\"type\": \"string\"}";
    var desc = S.err === "helpful"
      ? "Look up one booking by its ID and return its show, row, seats and amount paid. Use it before acting on a booking. It is read-only. If the ID is not found, don't guess another: ask the guest."
      : "Look up a booking.";
    return "lookup_booking: \"" + desc + "\" input_schema: {\"type\": \"object\", \"properties\": {\"booking_id\": " + idSchema +
      "}, \"required\": [\"booking_id\"]}";
  }

  function summary(S) {
    var n = S.res;
    return "Errors " + (S.err === "helpful" ? "instructive" : "bare") + ", " + (S.schema === "pattern" ? "pattern" : "free string") + ", confirmation " + (S.confirm ? "on" : "off") +
      ", " + capText(S.cap) + ", refund tool " + (S.refundTool ? "there" : "removed") + ": " + n.calls + " calls, " + n.made +
      " refunds made, " + n.wrong + " wrong, $" + n.money + " refunded, " + n.toPerson + " sent to a person.";
  }

  function toneOf(S) { return S.res.wrong > 0 ? "bad" : S.res.toPerson > 0 ? "warn" : "ok"; }

  /* ---------- the widget ---------- */

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    function el(tag, cls, style, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function head(text) { return el("p", "small muted", "margin:6px 0 0;font-weight:600;letter-spacing:.04em;", text); }
    var box = el("div", "", "display:grid;gap:8px;padding:10px;min-width:0;");
    box.appendChild(el("p", "muted", "margin:0;font-size:12px;",
      "No real model runs here. The stand-in follows stated rules from what it sees: its tools, their descriptions and schemas, " +
      "the last tool result, and whether refunds wait for confirmation. Bookings, prices and messages are the story's."));
    box.appendChild(head("The lookup tool, as sent"));
    var defLine = el("p", "", "margin:0;font-size:12px;font-family:var(--f-ui);overflow-wrap:anywhere;", "");
    box.appendChild(defLine);
    box.appendChild(head("The night, message by message"));
    var wrap = el("div", "table-wrap", "", "");
    var table = el("table", "", "font-size:12px;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["time", "message", "calls", "outcome", "refunded"].forEach(function (h) {
      hr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var body = el("tbody", "", "", "");
    table.appendChild(body);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var morning = el("p", "", "margin:0;font-size:13px;", "");
    morning.setAttribute("aria-live", "polite");
    box.appendChild(morning);
    box.appendChild(head("The trace: every tool_use and its tool_result, tied by id"));
    var trace = el("div", "", "display:grid;gap:2px;font-size:12px;font-family:var(--f-ui);overflow-wrap:anywhere;", "");
    box.appendChild(trace);
    api.root.appendChild(box);
    return { doc: doc, el: el, defLine: defLine, body: body, morning: morning, trace: trace };
  }

  function rowsFor(r) {
    var money = 0;
    r.released.forEach(function (id) { money += amountOf(id); });
    var wrong = r.released.filter(function (id) { return BOOKINGS[id].owner !== r.m.id; }).length;
    var held = r.held.length;
    var refunded = r.released.length ? "$" + money + (wrong ? ", " + wrong + " wrong" : "") : held ? held + " held" : "none";
    return [r.m.time, r.m.text.length > 46 ? r.m.text.slice(0, 44) + "..." : r.m.text, String(r.calls.length), OUTCOME[r.outcome], refunded];
  }

  function drawTable(S) {
    var ui = S.ui, el = ui.el;
    while (ui.body.firstChild) ui.body.removeChild(ui.body.firstChild);
    S.res.msgs.forEach(function (r) {
      var wrong = r.released.some(function (id) { return BOOKINGS[id].owner !== r.m.id; });
      var tr = el("tr", wrong ? "mark-no" : "", "", "");
      rowsFor(r).forEach(function (v) { tr.appendChild(el("td", "", "padding:2px 6px;", v)); });
      ui.body.appendChild(tr);
    });
    var n = S.res;
    ui.morning.textContent = n.held
      ? "Next morning the box office checks " + n.held + " held " + (n.held === 1 ? "refund" : "refunds") + ": " + n.approved + " approved" +
        (n.declined ? ", " + n.declined + " declined, because the name on the booking isn't the guest who wrote." : ", each asked for by the booking's own guest.")
      : n.wrong
        ? n.wrong + (n.wrong === 1 ? " refund" : " refunds") + " nobody asked for: " + n.msgs.map(function (r) {
          return r.released.filter(function (id) { return BOOKINGS[id].owner !== r.m.id; }).map(function (id) {
            return id + " (row " + BOOKINGS[id].row + ", " + BOOKINGS[id].seats + ")";
          }).join(", ");
        }).filter(function (s) { return s; }).join(", ") + ", $" + n.wrongMoney + "."
        : "No refunds nobody asked for.";
    ui.morning.className = n.wrong ? "mark-no" : "mark-ok";
  }

  function drawTrace(S) {
    var ui = S.ui, el = ui.el;
    while (ui.trace.firstChild) ui.trace.removeChild(ui.trace.firstChild);
    function line(text, cls, indent) {
      ui.trace.appendChild(el("div", cls || "", "padding-left:" + (indent || 0) + "px;", text));
    }
    S.res.msgs.forEach(function (r) {
      line(r.m.time + "  guest: " + r.m.text, "", 0);
      if (r.outcome === "answered") line("no tools: " + OUTCOME.answered, "muted", 14);
      if (r.outcome === "notool") line("no refund tool: sent to a person before any call", "muted", 14);
      r.calls.forEach(function (c) {
        line("tool_use id " + c.id + "  " + c.tool + " " + inputText(c.input) + "  (stop_reason tool_use)", "", 14);
        var res = c.result;
        var cls = res.rejected ? "muted" : res.released && BOOKINGS[c.input.booking_id].owner !== r.m.id ? "mark-no" : res.isError ? "mark-ok" : "";
        line("tool_result tool_use_id " + c.id + (res.isError ? "  is_error true" : "") + (res.rejected ? "  (the tool never ran)" : "") +
          "  " + res.text, cls, 28);
      });
      if (r.outcome === "cap") line("the app: call cap reached, loop ended, sent to a person", "mark-no", 14);
      line("reply (stop_reason end_turn): " + r.reply, "muted", 14);
    });
  }

  function drawStats(S) {
    var n = S.res;
    S.stat.made(n.made);
    S.stat.wrong(n.wrong);
    S.stat.money(n.money);
    S.stat.person(n.toPerson);
    S.stat.calls(n.calls);
    S.stat.most(n.maxCalls);
  }

  function draw(api) {
    var S = api.state;
    S.res = night(cfgOf(S));
    S.ui.defLine.textContent = lookupDefinition(S);
    drawTable(S);
    drawTrace(S);
    drawStats(S);
  }

  function setter(api, key, parse, label) {
    return function (v) {
      var S = api.state, val = parse(v);
      if (val === undefined) return;
      S[key] = val;
      draw(api);
      api.log(label(val) + " " + summary(S), toneOf(S));
    };
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e05", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 1;
      S.err = "bare";
      S.schema = "free";
      S.confirm = false;
      S.cap = 0;
      S.refundTool = true;
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.err = api.control.select("err", "The lookup's error result", ERR_KEYS.map(function (k) {
        return { value: k, label: ERR[k] };
      }), "bare", setter(api, "err", function (v) { return own(ERR, v) ? v : undefined; },
        function (v) { return v === "helpful" ? "Instructive errors." : "Bare errors."; }));
      S.ctl.schema = api.control.select("schema", "The booking ID's schema", SCHEMA_KEYS.map(function (k) {
        return { value: k, label: SCHEMA[k] };
      }), "free", setter(api, "schema", function (v) { return own(SCHEMA, v) ? v : undefined; },
        function (v) { return v === "pattern" ? "Pattern on." : "Free string."; }));
      S.ctl.confirm = api.control.toggle("confirm", "Refunds wait for a person to confirm", false,
        setter(api, "confirm", function (v) { return !!v; }, function (v) { return "Confirmation " + (v ? "on." : "off."); }));
      S.ctl.cap = api.control.select("cap", "Call cap per message", CAPS.map(function (c) {
        return { value: String(c), label: c > 0 ? String(c) : "No cap" };
      }), "0", setter(api, "cap", function (v) {
        var n = Math.round(Number(v));
        return CAPS.indexOf(n) >= 0 ? n : undefined;
      }, function (v) { return "Cap: " + capText(v) + "."; }));
      S.ctl.refundTool = api.control.toggle("refundTool", "The refund tool is available", true,
        setter(api, "refundTool", function (v) { return !!v; }, function (v) { return "Refund tool " + (v ? "back." : "removed."); }));
      S.ctl.reset = api.control.button("reset", "Reset to Friday night", function () { api.reset(); });

      S.stat = {
        made: api.stat("made", "refunds made", ""),
        wrong: api.stat("wrong", "wrong refunds", "bad"),
        money: api.stat("money", "money refunded ($)", "warn"),
        person: api.stat("person", "messages sent to a person", ""),
        calls: api.stat("calls", "tool calls in the night", ""),
        most: api.stat("most", "most calls for one message", "warn")
      };

      api.info("<strong>How to read it.</strong> Five messages came in on Friday night. For each, the trace shows every tool_use " +
        "the stand-in sent and the tool_result your code sent back, tied by the same id. A tool_use stops the reply with stop_reason " +
        "tool_use; the stand-in's last reply stops with end_turn. Its rules: it looks up the ID as the guest typed it; a bare result makes " +
        "it guess numbers near that one and keep every booking in the row the guest gave, until it has her seats or three results in a " +
        "row fail; an instructive error makes it stop and ask the guest. The pattern is checked before any tool runs. With confirmation " +
        "on, a release waits for a person at the box office, who approves it only for the booking's own guest. Tickets are $24 a seat.");
      draw(api);
      api.log("Sunday morning, the trace from Friday night. " + summary(S), toneOf(S));
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function cfg(o) {
        o = o || {};
        return { err: own(o, "err") ? o.err : "bare", schema: own(o, "schema") ? o.schema : "free",
          confirm: own(o, "confirm") ? o.confirm : false, cap: own(o, "cap") ? o.cap : 0,
          refundTool: own(o, "refundTool") ? o.refundTool : true };
      }
      function m4(n) { return n.msgs[3]; }
      function same(a, b) { return a.length === b.length && a.every(function (v, i) { return v === b[i]; }); }
      function inputs(r) { return r.calls.map(function (c) { return c.tool + ":" + c.input.booking_id; }); }
      var ok;

      // 1. The story night.
      await t.run(1);
      var s = night(cfg()), s4 = m4(s);
      t.expect(st().err === "bare" && st().schema === "free" && st().confirm === false && st().cap === 0 && st().refundTool === true &&
        t.stat("made") === 5 && t.stat("wrong") === 3 && t.stat("money") === 144 && t.stat("person") === 0 && t.stat("calls") === 19 &&
        t.stat("most") === 11 && s.wrongMoney === 72 &&
        same(inputs(s4), ["lookup_booking:bk-0417", "lookup_booking:0416", "release_and_refund:BK-0416", "send_email:BK-0416",
          "lookup_booking:0418", "release_and_refund:BK-0418", "send_email:BK-0418", "lookup_booking:0415", "lookup_booking:0419",
          "release_and_refund:BK-0419", "send_email:BK-0419"]) &&
        same(s4.released, ["BK-0416", "BK-0418", "BK-0419"]) && s4.emails.length === 3 &&
        s4.emails.every(function (e) { return e.text.indexOf(AS_REQUESTED) >= 0 && e.text.indexOf("$24") >= 0; }) &&
        s4.calls[0].result.text === BARE_NOT_FOUND && s4.calls[0].result.isError === false && s4.outcome === "done" &&
        same(s.msgs.map(function (r) { return r.calls.length; }), [0, 2, 3, 11, 3]) &&
        st().ui.morning.textContent.indexOf("BK-0416 (row A, seat 5), BK-0418 (row A, seat 9), BK-0419 (row A, seat 10), $72") >= 0 &&
        t.logText().indexOf("19 calls, 5 refunds made, 3 wrong, $144 refunded") >= 0,
        "the story night: bk-0417 gets a bare booking not found, the stand-in guesses 0416, 0418, 0415 and 0419, keeps the three front-row bookings and releases, refunds and emails each, as you requested: 11 calls; the night makes 19 calls, 5 refunds, 3 of them wrong, $144 refunded, $72 of it wrong, none sent to a person");

      // 2. An instructive error makes it ask the guest instead of guessing.
      var h = night(cfg({ err: "helpful" })), h4 = m4(h);
      t.expect(h4.calls.length === 1 && h4.outcome === "asked" && h4.calls[0].result.isError === true &&
        h4.calls[0].result.text.indexOf("ask the guest") >= 0 && h4.calls[0].result.text.indexOf("BK-0123") >= 0 &&
        h4.reply.indexOf("check the booking ID on your ticket") >= 0 &&
        h.calls === 9 && h.made === 2 && h.wrong === 0 && h.money === 72 && h.toPerson === 0,
        "an instructive error, marked is_error, says what an ID looks like and to ask the guest: message 4 makes 1 call and asks her to check her ticket; the night makes 9 calls, 2 refunds, none wrong, $72");

      // 3. The pattern rejects every malformed input before any tool runs.
      var p = night(cfg({ schema: "pattern" })), p4 = m4(p);
      ok = true;
      ["bare", "helpful"].forEach(function (e) {
        [true, false].forEach(function (cf) {
          CAPS.forEach(function (cp) {
            var n = night(cfg({ err: e, schema: "pattern", confirm: cf, cap: cp }));
            n.msgs.forEach(function (r) {
              r.calls.forEach(function (c) {
                if (c.tool === "lookup_booking" && !PATTERN_RE.test(c.input.booking_id) && (c.result.ran || !c.result.isError)) ok = false;
              });
            });
          });
        });
      });
      t.expect(ok && same(inputs(p4), ["lookup_booking:bk-0417", "lookup_booking:0416", "lookup_booking:0418"]) &&
        p4.calls.every(function (c) { return !c.result.ran && c.result.isError && c.result.text === BARE_INVALID; }) &&
        p4.outcome === "gaveup" && p4.released.length === 0 && p.calls === 11 && p.made === 2 && p.wrong === 0 && p.money === 72 &&
        m4(night(cfg({ schema: "pattern", err: "helpful" }))).calls.length === 1 &&
        m4(night(cfg({ schema: "pattern", err: "helpful" }))).calls[0].result.ran === false,
        "the pattern ^BK-[0-9]{4}$ rejects every malformed input before any tool runs, over every setting: bk-0417, 0416 and 0418 are turned away, three in a row, so the stand-in gives up with nothing released; 11 calls, 2 refunds, $72; with an instructive error too, 1 call and it asks the guest");

      // 4. Confirmation stops the refund.
      var c = night(cfg({ confirm: true })), c4 = m4(c);
      t.expect(c.wrong === 0 && c.held === 5 && c.approved === 2 && c.declined === 3 && c.made === 2 && c.money === 72 &&
        c4.calls.length === 8 && c4.emails.length === 0 && same(c4.held, ["BK-0416", "BK-0418", "BK-0419"]) && c4.released.length === 0 &&
        c.calls === 14 && c.toPerson === 0 && c4.outcome === "held",
        "confirmation on: every release is held and gets no email; message 4 makes 8 calls and releases nothing; next morning the box office approves 2 of 5 held refunds and declines the 3 nobody asked for: 2 refunds, none wrong, $72, 14 calls");

      // 5. The cap ends a loop, and never lets a message run past it.
      var k4 = night(cfg({ cap: 4 })), k3 = night(cfg({ cap: 3 })), k2 = night(cfg({ cap: 2 }));
      ok = true;
      ERR_KEYS.forEach(function (e) {
        SCHEMA_KEYS.forEach(function (sc) {
          [true, false].forEach(function (cf) {
            CAPS.forEach(function (cp) {
              [true, false].forEach(function (rt) {
                night(cfg({ err: e, schema: sc, confirm: cf, cap: cp, refundTool: rt })).msgs.forEach(function (r) {
                  if (cp > 0 && r.calls.length > cp) ok = false;
                  if (r.outcome === "cap" && (cp === 0 || r.calls.length !== cp || !r.toPerson)) ok = false;
                });
              });
            });
          });
        });
      });
      t.expect(ok && m4(k4).calls.length === 4 && m4(k4).outcome === "cap" && k4.wrong === 1 && k4.wrongMoney === 24 && k4.made === 3 &&
        k4.money === 96 && k4.calls === 12 && k4.toPerson === 1 &&
        k3.wrong === 1 && m4(k3).emails.length === 0 && k3.calls === 11 &&
        k2.wrong === 0 && k2.made === 2 && k2.toPerson === 3 && k2.calls === 8 && m4(k2).released.length === 0,
        "the cap: no message ever makes more calls than the cap, over every setting; a cap of 4 ends message 4 after one wrong refund ($24) and sends it to a person: 12 calls, 3 refunds, $96; a cap of 3 still makes 1 wrong refund; a cap of 2 ends it before any release but cuts messages 3 and 5 short too: 3 sent to a person");

      // 6. The refund tool removed: every refund request goes to a person.
      var x = night(cfg({ refundTool: false }));
      t.expect(x.toPerson === 3 && x.calls === 2 && x.made === 0 && x.money === 0 && x.wrong === 0 &&
        same(x.msgs.map(function (r) { return r.outcome; }), ["answered", "done", "notool", "notool", "notool"]) &&
        x.msgs.every(function (r) { return r.calls.every(function (cc) { return cc.tool !== "release_and_refund"; }); }) &&
        (x.toPerson !== c.toPerson || x.calls !== c.calls),
        "the refund tool removed: messages 3, 4 and 5 go to a person before any call; 2 calls in the night, 0 refunds, $0; different from confirmation, which keeps 0 sent to a person and 14 calls");

      // 7. The senior settings.
      var g = night(cfg({ err: "helpful", schema: "pattern", confirm: true, cap: SENIOR_CAP })), g4 = m4(g);
      t.expect(g.calls === 7 && g.maxCalls === 2 && g.made === 2 && g.wrong === 0 && g.money === 72 && g.toPerson === 0 &&
        g.held === 2 && g.approved === 2 && g4.calls.length === 1 && g4.calls[0].result.ran === false && g4.outcome === "asked" &&
        same(g.msgs.map(function (r) { return r.calls.length; }), [0, 2, 2, 1, 2]),
        "instructive errors, the pattern, confirmation and a cap of 6: 7 calls, at most 2 for a message, Mrs Pilbeam's ID rejected before the lookup runs and the guest asked, 2 refunds approved by the box office, none wrong, $72");

      // 8. Invariants over all 128 settings (2 x 2 x 2 x 8 caps x 2).
      ok = true;
      var count = 0;
      ERR_KEYS.forEach(function (e) {
        SCHEMA_KEYS.forEach(function (sc) {
          [true, false].forEach(function (cf) {
            CAPS.forEach(function (cp) {
              [true, false].forEach(function (rt) {
                count++;
                var n = night(cfg({ err: e, schema: sc, confirm: cf, cap: cp, refundTool: rt })), money = 0, ids = {};
                if (n.wrong > 0 && (cf || e !== "bare" || sc !== "free" || !rt)) ok = false;
                n.msgs.forEach(function (r) {
                  r.released.forEach(function (id) { money += amountOf(id); });
                  r.held.forEach(function (id) { if (BOOKINGS[id].owner === r.m.id) money += amountOf(id); });
                  r.calls.forEach(function (cc) { if (ids[cc.id]) ok = false; ids[cc.id] = true; });
                  if (cf && (r.released.length || r.emails.some(function (em) { return em.text.indexOf("refunded") >= 0; }))) ok = false;
                });
                if (money !== n.money || n.made > 5) ok = false;
              });
            });
          });
        });
      });
      t.expect(ok && count === 128,
        "over all 128 settings: wrong refunds happen only with bare errors, a free string, no confirmation and the refund tool there; every tool_use id is unique, so each tool_result ties to one call; with confirmation on nothing is released or emailed as refunded; the money always equals the refunds made");

      // 9. Deterministic.
      t.expect(JSON.stringify(night(cfg())) === JSON.stringify(night(cfg())) &&
        JSON.stringify(night(cfg({ confirm: true, cap: 4 }))) === JSON.stringify(night(cfg({ confirm: true, cap: 4 }))),
        "the same settings give the same night every time: no randomness anywhere");

      // 10. Every story number.
      t.expect(MESSAGES.length === 5 && SEAT_PRICE === 24 && amountOf("BK-0402") === 48 && amountOf("BK-0417") === 72 &&
        amountOf("BK-0433") === 24 && msg("m4").time === "23:52" && msg("m4").typed === "bk-0417" && msg("m4").party === 3 &&
        msg("m4").text.indexOf("the three of us") >= 0 && STORY_MESSAGE === "m4" && SHOW === "Saturday 19:30" && DOORS === "18:45" &&
        same(GUESSES, ["0416", "0418", "0415", "0419", "0414", "0420", "0413", "0421"]) && FAILS_IN_A_ROW === 3 &&
        findBooking("bk-0417") === null && findBooking("BK-0417") === "BK-0417" && findBooking("0416") === "BK-0416" &&
        findBooking("0415") === null && BOOKINGS["BK-0416"].seats === "seat 5" && BOOKINGS["BK-0418"].seats === "seat 9" &&
        BOOKINGS["BK-0419"].seats === "seat 10" && BOOKINGS["BK-0417"].seats === "seats 6 to 8" &&
        PATTERN_RE.test("BK-0417") && !PATTERN_RE.test("bk-0417") && !PATTERN_RE.test("0416") && START_CLOCK === 25200 && SENIOR_CAP === 6,
        "story numbers: five messages, $24 a seat, BK-0402 $48, Mrs Pilbeam's BK-0417 three seats 6 to 8 at $72, her message at 23:52 typed bk-0417; the guesses 0416, 0418, 0415, 0419 and on; the lookup case-sensitive, four digits alone matching; seats 5, 9 and 10 in row A; the show at Saturday 19:30, doors 18:45; three failures in a row; a cap of 6");

      // 11. The controls.
      t.set("err", "helpful");
      var v1 = t.stat("calls") === 9 && t.stat("wrong") === 0 && t.stat("money") === 72 &&
        st().ui.defLine.textContent.indexOf("don't guess another: ask the guest") >= 0;
      t.set("err", "bare");
      t.set("schema", "pattern");
      var v2 = t.stat("calls") === 11 && t.stat("wrong") === 0 && st().ui.defLine.textContent.indexOf("\"pattern\": \"^BK-[0-9]{4}$\"") >= 0;
      t.set("schema", "free");
      t.set("confirm", true);
      var v3 = t.stat("wrong") === 0 && t.stat("made") === 2 && t.stat("calls") === 14 &&
        st().ui.morning.textContent.indexOf("5 held refunds: 2 approved, 3 declined") >= 0;
      t.set("confirm", false);
      t.set("cap", "4");
      var v4 = t.stat("wrong") === 1 && t.stat("person") === 1 && t.stat("most") === 4 && t.stat("money") === 96;
      t.set("cap", "0");
      t.set("refundTool", false);
      var v5 = t.stat("person") === 3 && t.stat("calls") === 2 && t.stat("made") === 0;
      t.set("refundTool", true);
      t.set("err", "helpful");
      t.set("schema", "pattern");
      t.set("confirm", true);
      t.set("cap", "6");
      var v6 = t.stat("calls") === 7 && t.stat("most") === 2 && t.stat("wrong") === 0 && t.stat("made") === 2 && t.stat("person") === 0;
      t.click("reset");
      await t.run(1);
      var v7 = st().err === "bare" && st().cap === 0 && t.stat("wrong") === 3 && t.stat("calls") === 19;
      t.expect(v1 && v2 && v3 && v4 && v5 && v6 && v7,
        "the controls: instructive errors 9 calls and no wrong refunds; the pattern 11 calls; confirmation 14 calls, 5 held, 2 approved; a cap of 4 one wrong refund, one sent to a person, $96; the refund tool removed 3 sent to a person and 2 calls; the senior settings 7 calls; reset returns to Friday night");
    }
  });
})();
