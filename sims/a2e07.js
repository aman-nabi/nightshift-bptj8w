/* sims/a2e07-v1.0.0.js  (published as sims/a2e07.js)
   Case a2e07 "Words as They Arrive": a stream lab built from Senara's telegram desk at the Polgrean Head
   telegraph office, a museum open late on Thursdays, where a model's reply prints word by word on an old
   tape printer.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: a widget-style sim built inside api.root (no diagram), with a step()
     that plays one stream back in tenths of a second. It draws the tape, the stamp, the event stream as
     the app received it (real Anthropic event names), a table of what every completion rule does with
     the same stream, and a streamed against not streamed line, using theme classes only. Controls: what
     happens on the line (nothing, a drop, an error event), the word it breaks after, the stop reason
     (end_turn, or max_tokens cutting the reply after word 19), the app's completion rule (when the stream
     ends, 5 seconds with no text, on message_stop, on message_stop with stop_reason checked), play from
     the start, skip to the end, press stop (cancel), reset. selfTest covers the opening state before the
     first event, the story's 23:47 stream to the tenth of a second, the exact event order and where the
     stop reason travels, every rule on every scenario, every break point, streamed against not streamed,
     cancelling, the controls, every story number and reset.

   Where every number comes from (conventions rule 14; the case is content/latent/a2/a2e07-v1.0.0.json).
   All of them follow from WORDS, the timing constants and stream():
   - The reply (this morning's replay of Mrs Borlase's question, the post and the OP's reply): 26 words,
     WORDS. "Come down to the harbour, the boat is moored at the north steps, but it does not sail until
     07:40 tomorrow. No crossings run after dark." Word 8 is "is"; word 19 is "until". Each text_delta
     carries one word here, a teaching simplification (real deltas carry a few characters or words).
   - The timings (tenths of a second after the request, from the app's log and the replay; teaching
     values): the request at 0.0 (23:47:00.0); 200 OK, message_start and content_block_start at 0.8;
     one ping at 0.9; word k at 1.2 + 0.3 x (k - 1), so word 1 at 1.2, word 8 at 3.3, word 19 at 6.6
     and word 26 at 8.7; then content_block_stop 0.1 s after the last word, message_delta (carrying the
     stop reason) 0.2 s after, message_stop and the server closing the connection 0.3 s after: 8.8, 8.9
     and 9.0 for the full reply. Time to the first word, streamed: 1.2 s. Not streamed, the whole reply
     arrives with message_stop, so the first word waits for the last: 9.0 s.
   - The story (the post's log block): the line drops after word 8. The connection is lost 0.1 s after
     the word, at 3.4 s, 23:47:03.4. The museum's app stamps a telegram DELIVERED when the stream ends,
     for any reason: DELIVERED, bell rung, at 23:47:03.4, on 8 words, "Come down to the harbour, the
     boat is". Never received: 18 words, content_block_stop, message_delta and message_stop.
   - max_tokens (teaching: each word one token, max_tokens 19): the reply stops after word 19, "until",
     at 6.6; content_block_stop 6.7, message_delta with stop_reason max_tokens 6.8, message_stop 6.9.
   - An error event after word k: event: error, overloaded_error, 0.1 s after the word (3.4 s after word
     8), and the server closes the connection 0.1 s later (3.5 s).
   - The silence rule (u/chat_widget_tolver's comment and reply option B): stamp DELIVERED 5.0 s after the
     last text (or after the request if no text came).
   - Pressing stop at 2.0 s (tryThis and selfTest): words 1 to 3 have arrived (1.2, 1.5, 1.8), word 4
     would come at 2.1; the app closes the connection at 2.0.
   - The outcome matrix (stamp at seconds; right means the stamp matches whether the reply was really
     complete), in EXPECT in selfTest:
       scenario                    close            silence 5 s       message_stop     stop_reason checked
       full reply, end_turn        DELIVERED 9.0 ok DELIVERED 13.7 ok DELIVERED 9.0 ok DELIVERED 9.0 ok
       drop after word 8 (story)   DELIVERED 3.4 x  DELIVERED 8.3 x   INCOMPLETE 3.4 ok INCOMPLETE 3.4 ok
       error event after word 8    DELIVERED 3.5 x  DELIVERED 8.3 x   INCOMPLETE 3.5 ok INCOMPLETE 3.4 ok
       max_tokens, after word 19   DELIVERED 6.9 x  DELIVERED 11.6 x  DELIVERED 6.9 x   INCOMPLETE 6.9 ok
       stop pressed at 2.0         DELIVERED 2.0 x  DELIVERED 6.8 x   INCOMPLETE 2.0 ok STOPPED 2.0 ok
     The silence rule stamps the story's half telegram 4.9 s later than the museum's app did (8.3 against
     3.4), and stamps a full reply 4.7 s after its message_stop (13.7 against 9.0).
   - Reply part 2 for the automatic retry (option D): 8 words, then all 26 again from a new request on the
     same tape, 34 words with the first 8 twice.
   - Story-only numbers, not computed: the museum's late opening on Thursdays, Mrs Borlase on the north
     steps until about one, the first crossing at 07:40 inside the reply, and the cold case's figures.

   Notes for anyone copying this file:
   - Everything sits inside one function so nothing leaks into the page.
   - stream() is pure: settings in, the received events and every rule's stamp out. The widget only plays
     it back. Times are whole tenths of a second, so the arithmetic is exact.
   - The opening state is before the story's first event: nothing is sent until the first tick. Playback
     time S.t grows by dt in step(); the tenth shown is floor(S.t x 10 + 1e-6), so 60 ticks of 1/60 land
     on 1.0 s exactly. No event sits on a whole second that a selfTest waits for.
   - A drop here closes the connection, so the app notices at once. A real drop can also stall with
     nothing closed, which only an idle timeout finds: the case's explanation covers it.
   - api.speed is 0, so the engine never moves api.clock; step() and restart() set it to 23:47:00 plus the
     playback time, and it stops when playback stops. api.log is used for narration and the stamp, and the
     event stream is drawn in the widget.
   - Colors come only from theme classes: mark-ok, mark-no, muted, small, table-wrap. Fonts and spacing
     use style attributes, never colors.
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var START_CLOCK = 23 * 3600 + 47 * 60;   // 23:47:00, Mrs Borlase's question is sent
  var WORDS = ["Come", "down", "to", "the", "harbour,", "the", "boat", "is", "moored", "at", "the", "north",
    "steps,", "but", "it", "does", "not", "sail", "until", "07:40", "tomorrow.", "No", "crossings", "run",
    "after", "dark."];
  var T_START = 8;          // 200 OK, message_start and content_block_start (tenths of a second)
  var T_PING = 9;           // one ping
  var T_FIRST = 12;         // word 1
  var GAP = 3;              // one word every 0.3 s
  var SILENCE = 50;         // the silence rule: 5 s with no text
  var MAX_WORDS = 19;       // max_tokens cuts the reply after word 19, "until"
  var AFTER0 = 8, AFTER_MIN = 1, AFTER_MAX = 25;

  var LINES = {
    nothing: "Nothing: the line holds",
    drop: "The line drops",
    error: "An error event arrives (overloaded_error)"
  };
  var LINE_KEYS = ["nothing", "drop", "error"];
  var REASONS = {
    end_turn: "end_turn: the reply finishes",
    max_tokens: "max_tokens: cut off after word 19"
  };
  var REASON_KEYS = ["end_turn", "max_tokens"];
  var RULES = {
    close: "When the stream ends (the museum's app)",
    silence: "After 5 seconds with no text",
    stop: "On message_stop",
    checked: "On message_stop, stop_reason checked"
  };
  var RULE_SHORT = {
    close: "when the stream ends",
    silence: "5 seconds of silence",
    stop: "on message_stop",
    checked: "stop_reason checked"
  };
  var RULE_KEYS = ["close", "silence", "stop", "checked"];

  /* ---------- the stream (pure) ---------- */

  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function wordT(k) { return T_FIRST + GAP * (k - 1); }
  function sec(t) { return (t / 10).toFixed(1); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function clockAt(t) {
    var whole = START_CLOCK + Math.floor(t / 10), tenth = t % 10;
    return pad2(Math.floor(whole / 3600) % 24) + ":" + pad2(Math.floor((whole % 3600) / 60)) + ":" +
      pad2(whole % 60) + "." + tenth;
  }
  function lastOf(cfg) { return cfg.reason === "max_tokens" ? MAX_WORDS : WORDS.length; }
  function breaks(cfg) { return cfg.line !== "nothing" && cfg.after < lastOf(cfg); }

  // One request, as the app receives it. cfg: { line, after, reason, rule, cancelAt (tenths or null) }.
  function stream(cfg) {
    var L = lastOf(cfg), ev = [], k;
    ev.push({ t: 0, kind: "http", name: "POST /v1/messages", text: "stream: true" });
    ev.push({ t: T_START, kind: "http", name: "200 OK", text: "content-type: text/event-stream" });
    ev.push({ t: T_START, kind: "sse", name: "message_start", text: "stop_reason: null" });
    ev.push({ t: T_START, kind: "sse", name: "content_block_start", text: "index 0, type text" });
    ev.push({ t: T_PING, kind: "sse", name: "ping", text: "" });
    for (k = 1; k <= L; k++) {
      ev.push({ t: wordT(k), kind: "sse", name: "content_block_delta", text: "text_delta \"" + WORDS[k - 1] + "\"", word: k });
    }
    var tl = wordT(L);
    ev.push({ t: tl + 1, kind: "sse", name: "content_block_stop", text: "index 0" });
    ev.push({ t: tl + 2, kind: "sse", name: "message_delta", text: "stop_reason: " + cfg.reason });
    ev.push({ t: tl + 3, kind: "sse", name: "message_stop", text: "" });
    ev.push({ t: tl + 3, kind: "close", name: "connection closed", text: "by the server, after message_stop" });

    var broke = null;
    if (breaks(cfg)) {
      var cut = wordT(cfg.after) + 1;
      ev = ev.filter(function (e) { return e.t < cut; });
      if (cfg.line === "drop") {
        ev.push({ t: cut, kind: "close", name: "connection lost", text: "the line dropped" });
      } else {
        ev.push({ t: cut, kind: "sse", name: "error", text: "overloaded_error: Overloaded" });
        ev.push({ t: cut + 1, kind: "close", name: "connection closed", text: "by the server, after the error" });
      }
      broke = { line: cfg.line, t: cut };
    }

    var cancelled = null;
    if (cfg.cancelAt !== null && cfg.cancelAt !== undefined && cfg.cancelAt < ev[ev.length - 1].t) {
      var c = Math.max(0, cfg.cancelAt);
      ev = ev.filter(function (e) { return e.t <= c; });
      ev.push({ t: c, kind: "cancel", name: "stop pressed", text: "the app closed the connection" });
      cancelled = c;
    }

    var words = ev.filter(function (e) { return !!e.word; });
    function find(name) {
      for (var i = 0; i < ev.length; i++) if (ev[i].kind === "sse" && ev[i].name === name) return ev[i];
      return null;
    }
    var stopEv = find("message_stop"), errEv = find("error");
    var closeT = ev[ev.length - 1].t;
    var complete = !!stopEv && cfg.reason === "end_turn";
    var lastText = words.length ? words[words.length - 1].t : 0;

    function decide(rule) {
      if (rule === "close") return { stamp: "DELIVERED", t: closeT, why: "the stream ended" };
      if (rule === "silence") return { stamp: "DELIVERED", t: lastText + SILENCE, why: "no text for 5 seconds" };
      if (rule === "stop") {
        if (stopEv) return { stamp: "DELIVERED", t: stopEv.t, why: "message_stop arrived" };
        return { stamp: "INCOMPLETE", t: closeT, why: "the stream ended without message_stop" };
      }
      if (stopEv) {
        if (cfg.reason === "end_turn") return { stamp: "DELIVERED", t: stopEv.t, why: "message_stop, stop_reason end_turn" };
        return { stamp: "INCOMPLETE", t: stopEv.t, why: "stop_reason max_tokens: cut off at the length limit" };
      }
      if (errEv && (cancelled === null || errEv.t <= cancelled)) {
        return { stamp: "INCOMPLETE", t: errEv.t, why: "an error event, overloaded_error" };
      }
      if (cancelled !== null) return { stamp: "STOPPED", t: cancelled, why: "the visitor pressed stop" };
      return { stamp: "INCOMPLETE", t: closeT, why: "the line dropped before message_stop" };
    }

    var stamps = {};
    RULE_KEYS.forEach(function (r) {
      var d = decide(r);
      d.right = (d.stamp === "DELIVERED") === complete;
      stamps[r] = d;
    });
    var mine = stamps[cfg.rule] || stamps.close;
    return {
      cfg: cfg, events: ev, words: words, text: words.map(function (e) { return WORDS[e.word - 1]; }).join(" "),
      L: L, broke: broke, cancelled: cancelled, stopEv: stopEv, errEv: errEv, closeT: closeT,
      complete: complete, stamps: stamps, mine: mine, end: Math.max(closeT, mine.t),
      first: words.length ? words[0].t : null,
      firstOff: breaks(cfg) ? null : wordT(L) + 3
    };
  }

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
      "Timings are teaching values from the app's log and this morning's replay: one word per text delta, every 0.3 seconds. " +
      "A drop here closes the connection at once; a real one can also just go quiet."));

    box.appendChild(head("The tape"));
    var tape = el("p", "", "margin:0;padding:8px 10px;min-height:2.8em;font-family:var(--f-type), 'Courier New', monospace;" +
      "font-size:15px;line-height:1.5;border:1px dashed currentColor;border-radius:4px;overflow-wrap:anywhere;", "");
    tape.setAttribute("aria-label", "The printed tape");
    box.appendChild(tape);
    var stampLine = el("p", "", "margin:0;font-size:13px;", "");
    stampLine.setAttribute("aria-live", "polite");
    box.appendChild(stampLine);

    box.appendChild(head("The event stream, as the app received it"));
    var wrap = el("div", "table-wrap", "max-height:260px;overflow-y:auto;", "");
    var table = el("table", "", "font-size:12px;", "");
    var thead = el("thead", "", "", "");
    var hr = el("tr", "", "", "");
    ["time", "event", "data"].forEach(function (h) {
      hr.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var evBody = el("tbody", "", "", "");
    table.appendChild(evBody);
    wrap.appendChild(table);
    box.appendChild(wrap);

    box.appendChild(head("What each completion rule does with this stream"));
    var wrap2 = el("div", "table-wrap", "", "");
    var table2 = el("table", "", "font-size:12px;", "");
    var thead2 = el("thead", "", "", "");
    var hr2 = el("tr", "", "", "");
    ["completion rule", "stamp", "at (s)", "right?"].forEach(function (h) {
      hr2.appendChild(el("th", "", "text-align:left;padding:2px 6px;white-space:nowrap;", h));
    });
    thead2.appendChild(hr2);
    table2.appendChild(thead2);
    var ruleBody = el("tbody", "", "", "");
    table2.appendChild(ruleBody);
    wrap2.appendChild(table2);
    box.appendChild(wrap2);
    var truthLine = el("p", "", "margin:0;font-size:13px;", "");
    box.appendChild(truthLine);

    box.appendChild(head("Streamed against not streamed"));
    var speedLine = el("p", "", "margin:0;font-size:13px;", "");
    box.appendChild(speedLine);

    api.root.appendChild(box);
    return { el: el, tape: tape, stampLine: stampLine, evBody: evBody, ruleBody: ruleBody, truthLine: truthLine,
      speedLine: speedLine };
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- drawing ---------- */

  function shown(S) { return S.run.events.filter(function (e) { return e.t <= S.now; }); }

  function drawTape(S) {
    var ui = S.ui, r = S.run, got = shown(S).filter(function (e) { return !!e.word; });
    var text = got.map(function (e) { return WORDS[e.word - 1]; }).join(" ");
    ui.tape.textContent = text;
    S.tapeText = text;
    var m = r.mine;
    if (S.now < 0) {
      ui.stampLine.textContent = "Not sent yet.";
      ui.stampLine.className = "muted";
    } else if (S.now < m.t) {
      ui.stampLine.textContent = S.now < r.closeT ? "Printing: " + got.length + (got.length === 1 ? " word" : " words") + " so far." :
        "The stream has ended. The app is still waiting to stamp the telegram.";
      ui.stampLine.className = "muted";
    } else if (m.stamp === "DELIVERED") {
      ui.stampLine.textContent = "DELIVERED, bell rung, at " + clockAt(m.t) + ": " + m.why + "." +
        (m.right ? "" : " The reply was not complete.");
      ui.stampLine.className = m.right ? "mark-ok" : "mark-no";
    } else {
      ui.stampLine.textContent = "[PARTIAL] " + m.stamp + " at " + clockAt(m.t) + ": " + m.why + ". Shown as partial; ask again.";
      ui.stampLine.className = "mark-ok";
    }
  }

  function drawEvents(S) {
    var ui = S.ui, el = ui.el, list = shown(S);
    if (S.rows === list.length) return;
    clear(ui.evBody);
    list.forEach(function (e) {
      var tr = el("tr", e.kind === "close" || e.kind === "cancel" || e.name === "error" ? "mark-no" :
        e.name === "message_stop" ? "mark-ok" : "", "", "");
      tr.appendChild(el("td", "", "padding:2px 6px;white-space:nowrap;", clockAt(e.t)));
      tr.appendChild(el("td", "", "padding:2px 6px;white-space:nowrap;", e.kind === "sse" ? "event: " + e.name : e.name));
      tr.appendChild(el("td", "", "padding:2px 6px;white-space:nowrap;", e.text));
      ui.evBody.appendChild(tr);
    });
    S.rows = list.length;
  }

  function drawRules(S) {
    var ui = S.ui, el = ui.el, r = S.run;
    clear(ui.ruleBody);
    RULE_KEYS.forEach(function (k) {
      var d = r.stamps[k];
      var tr = el("tr", "", k === S.rule ? "font-weight:600;" : "", "");
      [RULES[k], d.stamp, sec(d.t), d.right ? "right" : "wrong"].forEach(function (v, i) {
        tr.appendChild(el("td", i === 3 ? (d.right ? "mark-ok" : "mark-no") : "", "padding:2px 6px;white-space:nowrap;", v));
      });
      ui.ruleBody.appendChild(tr);
    });
    ui.truthLine.textContent = "Really complete: " + (r.complete ? "yes, message_stop with stop_reason end_turn." :
      r.cancelled !== null ? "no, the visitor pressed stop after " + r.words.length + " words." :
      r.broke ? "no, the " + (r.broke.line === "drop" ? "line dropped" : "error event came") + " after word " + r.cfg.after + "." :
      "no, stop_reason max_tokens: the reply was cut off after word " + r.L + ".");
    ui.truthLine.className = r.complete ? "" : "mark-no";
  }

  function drawSpeed(S) {
    var r = S.run;
    S.ui.speedLine.textContent = "First word, streamed: " + (r.first === null ? "none" : sec(r.first) + " s") +
      ". Not streamed: " + (r.firstOff === null ? "never: the line broke before the reply ended, so a single response would be lost" :
      sec(r.firstOff) + " s, all " + r.L + " words at once with message_stop") + "." +
      (r.firstOff === null ? "" : " Total time to message_stop: " + sec(r.firstOff) + " s either way.");
  }

  function drawStats(S) {
    var r = S.run, m = r.mine;
    S.stat.words(shown(S).filter(function (e) { return !!e.word; }).length);
    S.stat.stamp(S.now >= 0 && S.now >= m.t ? m.stamp : "waiting");
    S.stat.truth(S.now >= 0 && S.now >= r.closeT ? (r.complete ? "yes" : "no") : "not yet");
    S.stat.at(S.now >= 0 && S.now >= m.t ? sec(m.t) : "not yet");
    S.stat.first(r.first === null ? "none" : sec(r.first));
    S.stat.firstOff(r.firstOff === null ? "never" : sec(r.firstOff));
  }

  function draw(S) {
    drawTape(S);
    drawEvents(S);
    drawStats(S);
  }

  function drawAll(S) {
    S.rows = -1;
    drawRules(S);
    drawSpeed(S);
    draw(S);
  }

  /* ---------- narration and controls ---------- */

  function cfgOf(S) {
    return { line: S.line, after: S.after, reason: S.reason, rule: S.rule, cancelAt: S.cancelAt };
  }

  function summary(S) {
    var r = S.run, m = r.mine;
    var what = S.line === "nothing" ? "The line holds" : !breaks(cfgOf(S)) ? "The reply ends before word " + S.after + ", so nothing breaks" :
      (S.line === "drop" ? "The line drops" : "An error event comes") + " after word " + S.after;
    return what + ", stop_reason " + S.reason + ", rule: " + RULE_SHORT[S.rule] + ". The app stamps " + m.stamp + " at " + sec(m.t) +
      " s on " + r.words.length + (r.words.length === 1 ? " word" : " words") + ": " + (m.right ? "right." : "wrong.");
  }

  function stampNote(S) {
    var r = S.run, m = r.mine;
    if (m.stamp === "DELIVERED") {
      return "DELIVERED, bell rung, on " + r.words.length + " words" + (m.right ? "." : ": the reply was not complete.");
    }
    return m.stamp + " on " + r.words.length + " words: " + m.why + ".";
  }

  function toneOf(S) { return S.run.mine.right ? "ok" : "bad"; }

  function tenthOf(t) { return Math.floor(t * 10 + 1e-6); }

  function restart(api, note) {
    var S = api.state;
    S.cancelAt = null;
    S.run = stream(cfgOf(S));
    S.t = 0;
    S.now = -1;
    S.playing = true;
    S.stamped = false;
    api.clock = START_CLOCK;
    drawAll(S);
    if (note) api.log(note, toneOf(S));
  }

  function advance(api, now) {
    var S = api.state;
    if (now > S.run.end) now = S.run.end;
    S.now = now;
    api.clock = START_CLOCK + Math.max(0, now) / 10;
    if (now >= S.run.end) S.playing = false;
    draw(S);
    if (!S.stamped && now >= S.run.mine.t) {
      S.stamped = true;
      api.log(stampNote(S), toneOf(S));
    }
  }

  function setLine(api, v) {
    var S = api.state;
    if (!own(LINES, v)) return;
    S.line = v;
    restart(api, summary(S));
  }

  function setAfter(api, v) {
    var S = api.state, n = Math.round(Number(v));
    if (!(n >= AFTER_MIN && n <= AFTER_MAX)) return;
    S.after = n;
    restart(api, summary(S));
  }

  function setReason(api, v) {
    var S = api.state;
    if (!own(REASONS, v)) return;
    S.reason = v;
    restart(api, summary(S));
  }

  function setRule(api, v) {
    var S = api.state;
    if (!own(RULES, v)) return;
    S.rule = v;
    restart(api, summary(S));
  }

  function cancel(api) {
    var S = api.state;
    if (S.cancelAt !== null) { api.log("Stop was already pressed.", ""); return; }
    var at = Math.max(0, S.now);
    if (at >= S.run.closeT) { api.log("Too late to stop: the stream has already ended.", ""); return; }
    S.cancelAt = at;
    S.run = stream(cfgOf(S));
    S.playing = true;
    drawAll(S);
    api.log("Stop pressed at " + sec(at) + " s: the app closes the connection after " + S.run.words.length +
      (S.run.words.length === 1 ? " word." : " words."), "warn");
    advance(api, Math.max(0, S.now));
  }

  function skip(api) {
    var S = api.state;
    S.t = S.run.end / 10;
    advance(api, S.run.end);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a2e07", {
    startClock: START_CLOCK,

    setup: function (api) {
      var S = api.state;
      api.speed = 0;            // the engine never moves the clock; step() sets it to 23:47:00 plus playback time
      S.line = "drop";
      S.after = AFTER0;
      S.reason = "end_turn";
      S.rule = "close";
      S.ui = buildWidget(api);

      S.ctl = {};
      S.ctl.line = api.control.select("line", "What happens on the line", LINE_KEYS.map(function (k) {
        return { value: k, label: LINES[k] };
      }), "drop", function (v) { setLine(api, v); });
      S.ctl.after = api.control.range("after", "It breaks after word", AFTER_MIN, AFTER_MAX, 1, AFTER0,
        function (v) { setAfter(api, v); });
      S.ctl.reason = api.control.select("reason", "Stop reason", REASON_KEYS.map(function (k) {
        return { value: k, label: REASONS[k] };
      }), "end_turn", function (v) { setReason(api, v); });
      S.ctl.rule = api.control.select("rule", "The app's completion rule", RULE_KEYS.map(function (k) {
        return { value: k, label: RULES[k] };
      }), "close", function (v) { setRule(api, v); });
      S.ctl.play = api.control.button("play", "Play from the start", function () { restart(api, "Playing again from 23:47:00."); });
      S.ctl.cancel = api.control.button("cancel", "Press stop (cancel)", function () { cancel(api); });
      S.ctl.end = api.control.button("end", "Skip to the end", function () { skip(api); });
      S.ctl.reset = api.control.button("reset", "Reset to 23:47", function () { api.reset(); });

      S.stat = {
        words: api.stat("words", "words on the tape", ""),
        stamp: api.stat("stamp", "the app's stamp", "warn"),
        truth: api.stat("truth", "really complete?", ""),
        at: api.stat("at", "stamped at (s)", ""),
        first: api.stat("first", "first word, streamed (s)", "ok"),
        firstOff: api.stat("firstOff", "first word, not streamed (s)", "bad")
      };

      api.info("<strong>How to read it.</strong> The app sends Mrs Borlase's question with stream: true, and the reply comes back " +
        "as server-sent events: message_start, a content block (content_block_start, one content_block_delta per word here, " +
        "content_block_stop), message_delta carrying the stop reason, then message_stop, with a ping on the way. The tape shows " +
        "what has printed. The completion rule decides when the app stamps the telegram DELIVERED and rings the bell; the table " +
        "shows what every rule would do with the same stream, and whether it matches what really happened. Press stop while it " +
        "plays to cancel from the app's side.");

      S.cancelAt = null;
      S.run = stream(cfgOf(S));
      S.t = 0;
      S.now = -1;
      S.playing = true;
      S.stamped = false;
      drawAll(S);
      api.log("23:47. Mrs Borlase asks how to get to Pendour tonight. The question goes out with stream: true.", "");
    },

    step: function (api, dt) {
      var S = api.state;
      if (!S.playing || !S.run) return;
      S.t += dt;
      var now = tenthOf(S.t);
      if (now !== S.now) advance(api, now);
      else api.clock = START_CLOCK + Math.max(0, S.now) / 10;
    },

    selfTest: async function (t) {
      function st() { return t.api.state; }
      function names(r) { return r.events.map(function (e) { return e.name; }); }
      function cfg(line, after, reason, rule, cancelAt) {
        return { line: line, after: after, reason: reason, rule: rule || "close", cancelAt: cancelAt === undefined ? null : cancelAt };
      }
      function rows() { return st().ui.evBody.children.length; }
      function evText() { return st().ui.evBody.textContent; }
      var ok, i;

      // 1. The opening state, before the story's first event.
      var v1 = st().now === -1 && rows() === 0 && st().ui.tape.textContent === "" && t.stat("words") === 0 &&
        t.stat("stamp") === "waiting" && t.stat("truth") === "not yet" && t.stat("at") === "not yet" &&
        st().line === "drop" && st().after === 8 && st().reason === "end_turn" && st().rule === "close" &&
        t.stat("first") === 1.2 && t.stat("firstOff") === "never" && t.logText().indexOf("stream: true") >= 0;
      t.expect(v1, "the sim opens before the first event: nothing sent, an empty tape, no events, the stamp waiting; the story's settings: the line drops after word 8, end_turn, the museum's rule (when the stream ends); first word 1.2 s streamed, never without streaming on a broken line");

      // 2. The story, to the tenth of a second.
      await t.run(1);
      var v2a = rows() === 5 && t.stat("words") === 0 && evText().indexOf("event: message_start") >= 0 &&
        evText().indexOf("event: ping") >= 0 && evText().indexOf("200 OK") >= 0 && t.stat("stamp") === "waiting";
      await t.run(2.5);
      var v2b = t.stat("words") === 8 && st().ui.tape.textContent === "Come down to the harbour, the boat is" &&
        t.stat("stamp") === "DELIVERED" && t.stat("at") === 3.4 && t.stat("truth") === "no" &&
        st().ui.stampLine.textContent.indexOf("DELIVERED, bell rung, at 23:47:03.4") === 0 &&
        evText().indexOf("23:47:03.3") >= 0 && evText().indexOf("connection lost") >= 0 &&
        evText().indexOf("message_stop") < 0 && evText().indexOf("message_delta") < 0 &&
        t.logText().indexOf("DELIVERED, bell rung, on 8 words: the reply was not complete.") >= 0 && st().playing === false;
      t.expect(v2a && v2b, "the story: by 1.0 s the app has POST, 200 OK, message_start, content_block_start and a ping and no words; word 8, 'is', arrives at 23:47:03.3, the line drops at 03.4 and the museum's app stamps DELIVERED and rings the bell at 23:47:03.4 on 'Come down to the harbour, the boat is'; no message_delta or message_stop ever came");

      // 3. The event order and where the stop reason travels.
      var full = stream(cfg("nothing", 8, "end_turn")), n = names(full);
      var expectNames = ["POST /v1/messages", "200 OK", "message_start", "content_block_start", "ping"];
      for (i = 0; i < 26; i++) expectNames.push("content_block_delta");
      expectNames.push("content_block_stop", "message_delta", "message_stop", "connection closed");
      ok = n.length === expectNames.length && n.every(function (x, j) { return x === expectNames[j]; });
      var carriers = full.events.filter(function (e) { return e.text.indexOf("stop_reason: end_turn") >= 0; });
      var times = full.events.map(function (e) { return e.t; });
      var sorted = times.every(function (x, j) { return j === 0 || x >= times[j - 1]; });
      t.expect(ok && sorted && carriers.length === 1 && carriers[0].name === "message_delta" &&
        full.events[2].text === "stop_reason: null" && full.words.length === 26 && full.first === 12 &&
        full.words[25].t === 87 && full.stopEv.t === 90 && full.closeT === 90 && full.complete &&
        full.text === WORDS.join(" "),
        "a full reply: POST, 200 OK, message_start (stop_reason null), content_block_start, ping, 26 content_block_delta events from 1.2 s to 8.7 s, content_block_stop, message_delta carrying stop_reason end_turn (the only event that carries it), message_stop at 9.0 s, in time order");

      // 4. Every rule on every scenario: the outcome matrix in the header.
      var EXPECT = [
        [cfg("nothing", 8, "end_turn"), { close: ["DELIVERED", 90, true], silence: ["DELIVERED", 137, true], stop: ["DELIVERED", 90, true], checked: ["DELIVERED", 90, true] }],
        [cfg("drop", 8, "end_turn"), { close: ["DELIVERED", 34, false], silence: ["DELIVERED", 83, false], stop: ["INCOMPLETE", 34, true], checked: ["INCOMPLETE", 34, true] }],
        [cfg("error", 8, "end_turn"), { close: ["DELIVERED", 35, false], silence: ["DELIVERED", 83, false], stop: ["INCOMPLETE", 35, true], checked: ["INCOMPLETE", 34, true] }],
        [cfg("nothing", 8, "max_tokens"), { close: ["DELIVERED", 69, false], silence: ["DELIVERED", 116, false], stop: ["DELIVERED", 69, false], checked: ["INCOMPLETE", 69, true] }],
        [cfg("nothing", 8, "end_turn", "close", 20), { close: ["DELIVERED", 20, false], silence: ["DELIVERED", 68, false], stop: ["INCOMPLETE", 20, true], checked: ["STOPPED", 20, true] }]
      ];
      ok = true;
      EXPECT.forEach(function (row) {
        var r = stream(row[0]);
        RULE_KEYS.forEach(function (k) {
          var d = r.stamps[k], e = row[1][k];
          if (d.stamp !== e[0] || d.t !== e[1] || d.right !== e[2]) ok = false;
        });
      });
      var mt = stream(cfg("nothing", 8, "max_tokens")), cx = stream(cfg("nothing", 8, "end_turn", "close", 20));
      t.expect(ok && mt.text.split(" ").slice(-4).join(" ") === "does not sail until" && mt.words.length === 19 &&
        mt.events.filter(function (e) { return e.name === "message_delta"; })[0].text === "stop_reason: max_tokens" &&
        cx.text === "Come down to" && cx.words.length === 3 && cx.events[cx.events.length - 1].name === "stop pressed",
        "every rule on every scenario: when the stream ends is right only on a full reply; 5 seconds of silence stamps every break, max_tokens and a cancel DELIVERED, 4.9 s later than the museum's app on the story's drop; message_stop alone passes max_tokens; only message_stop with stop_reason end_turn is right every time; max_tokens ends on 'does not sail until'; stop at 2.0 s leaves 'Come down to'");

      // 5. Every break point, both kinds of break, both stop reasons.
      ok = true;
      ["drop", "error"].forEach(function (line) {
        REASON_KEYS.forEach(function (reason) {
          for (var a = AFTER_MIN; a <= AFTER_MAX; a++) {
            var r = stream(cfg(line, a, reason)), L = reason === "max_tokens" ? 19 : 26;
            if (a < L) {
              if (r.words.length !== a || r.complete || r.stopEv || r.firstOff !== null) ok = false;
              if (r.stamps.close.stamp !== "DELIVERED" || r.stamps.close.right) ok = false;
              if (r.stamps.silence.stamp !== "DELIVERED" || r.stamps.silence.t !== wordT(a) + SILENCE) ok = false;
              if (r.stamps.checked.stamp !== "INCOMPLETE" || r.stamps.checked.t !== wordT(a) + 1) ok = false;
              if (r.stamps.stop.stamp !== "INCOMPLETE") ok = false;
              if (line === "error" && !r.errEv) ok = false;
            } else if (r.broke || r.words.length !== L || !r.stopEv) ok = false;
            RULE_KEYS.forEach(function (k) {
              if (k === "checked" && !r.stamps[k].right) ok = false;
              if (r.stamps[k].stamp === "DELIVERED" && r.stamps[k].right !== r.complete) ok = false;
            });
          }
        });
      });
      t.expect(ok, "every break point from word 1 to 25, drop or error, end_turn or max_tokens: the tape holds exactly the words before the break, no message_stop arrives, when the stream ends and 5 seconds of silence stamp it DELIVERED, and the stop_reason rule marks it INCOMPLETE 0.1 s after the last word; a break after max_tokens has ended the reply changes nothing; the stop_reason rule is never wrong");

      // 6. Streamed against not streamed.
      t.set("line", "nothing");
      var v6a = t.stat("first") === 1.2 && t.stat("firstOff") === 9 && st().ui.speedLine.textContent.indexOf("all 26 words at once") >= 0 &&
        st().now === -1 && t.stat("words") === 0;
      t.set("reason", "max_tokens");
      var v6b = t.stat("firstOff") === 6.9 && t.stat("first") === 1.2;
      t.set("reason", "end_turn");
      t.expect(v6a && v6b && full.firstOff === 90 && full.first === 12,
        "streamed, the first word prints at 1.2 s; not streamed, it waits for the last: 9.0 s for the full reply, 6.9 s when max_tokens cuts it; a changed setting starts the playback again from the opening state");

      // 7. Pressing stop while it prints.
      t.set("rule", "checked");
      await t.run(2);
      t.click("cancel");
      await t.run(0.5);
      var v7 = st().cancelAt === 20 && t.stat("words") === 3 && st().ui.tape.textContent === "Come down to" &&
        t.stat("stamp") === "STOPPED" && t.stat("at") === 2 && t.stat("truth") === "no" && evText().indexOf("stop pressed") >= 0 &&
        st().ui.stampLine.textContent.indexOf("[PARTIAL] STOPPED at 23:47:02.0") === 0 &&
        t.logText().indexOf("Stop pressed at 2.0 s: the app closes the connection after 3 words.") >= 0;
      t.click("cancel");
      var v7b = t.logText().indexOf("Stop was already pressed.") >= 0;
      t.expect(v7 && v7b, "press stop at 2.0 s with the stop_reason rule: three words printed, 'Come down to', the app closes the connection and marks the telegram STOPPED, shown as partial; pressing again changes nothing");

      // 8. The controls, rule by rule, on the story's drop and the other breaks.
      t.set("line", "drop");
      t.set("after", 8);
      t.set("rule", "silence");
      t.click("end");
      var v8a = t.stat("stamp") === "DELIVERED" && t.stat("at") === 8.3 && t.stat("words") === 8 && t.stat("truth") === "no";
      t.set("rule", "checked");
      t.click("end");
      var v8b = t.stat("stamp") === "INCOMPLETE" && t.stat("at") === 3.4 && t.stat("truth") === "no" &&
        st().ui.stampLine.textContent.indexOf("[PARTIAL] INCOMPLETE at 23:47:03.4: the line dropped before message_stop") === 0;
      t.set("line", "error");
      t.click("end");
      var v8c = t.stat("stamp") === "INCOMPLETE" && t.stat("at") === 3.4 && evText().indexOf("overloaded_error") >= 0 &&
        evText().indexOf("event: error") >= 0;
      t.set("line", "nothing");
      t.set("reason", "max_tokens");
      t.click("end");
      var v8d = t.stat("stamp") === "INCOMPLETE" && t.stat("at") === 6.9 && t.stat("words") === 19 &&
        /until$/.test(st().ui.tape.textContent) && evText().indexOf("stop_reason: max_tokens") >= 0;
      t.set("rule", "stop");
      t.click("end");
      var v8e = t.stat("stamp") === "DELIVERED" && t.stat("at") === 6.9 && t.stat("truth") === "no";
      t.set("reason", "end_turn");
      t.set("rule", "silence");
      t.click("end");
      var v8f = t.stat("stamp") === "DELIVERED" && t.stat("at") === 13.7 && t.stat("truth") === "yes" && t.stat("words") === 26;
      t.set("rule", "checked");
      t.click("end");
      var v8g = t.stat("stamp") === "DELIVERED" && t.stat("at") === 9 && t.stat("truth") === "yes" &&
        st().ui.tape.textContent === WORDS.join(" ");
      t.click("cancel");
      var v8h = t.logText().indexOf("Too late to stop: the stream has already ended.") >= 0 && st().cancelAt === null;
      t.expect(v8a && v8b && v8c && v8d && v8e && v8f && v8g && v8h,
        "the controls: on the story's drop 5 seconds of silence stamps the same 8 words DELIVERED at 8.3 s, and the stop_reason rule marks them INCOMPLETE at 3.4 s; an error event is marked INCOMPLETE at 3.4 s; max_tokens ends on 'until' after 19 words, INCOMPLETE under the stop_reason rule and DELIVERED under message_stop alone at 6.9 s; a full reply is DELIVERED at 13.7 s under the silence rule and at 9.0 s under the stop_reason rule; stop after the end does nothing");

      // 9. Every story number.
      t.expect(WORDS.length === 26 && WORDS.slice(0, 8).join(" ") === "Come down to the harbour, the boat is" && WORDS[7] === "is" &&
        WORDS[18] === "until" && WORDS.slice(14, 21).join(" ") === "it does not sail until 07:40 tomorrow." &&
        wordT(1) === 12 && wordT(8) === 33 && wordT(19) === 66 && wordT(26) === 87 && T_START === 8 && T_PING === 9 && GAP === 3 &&
        SILENCE === 50 && MAX_WORDS === 19 && START_CLOCK === 85620 && clockAt(0) === "23:47:00.0" && clockAt(34) === "23:47:03.4" &&
        clockAt(90) === "23:47:09.0" && sec(137) === "13.7" && 26 - 8 === 18 && 8 + 26 === 34 && 83 - 34 === 49 && 137 - 90 === 47,
        "story numbers: 26 words, word 8 'is' and word 19 'until'; the request at 23:47:00.0, 200 OK and message_start at 0.8 s, a ping at 0.9 s, word 1 at 1.2 s and one every 0.3 s, word 8 at 3.3 s, the drop at 23:47:03.4, the last word at 8.7 s and message_stop at 9.0 s; 18 words never arrived; 5 seconds of silence; max_tokens after 19 words; 34 words on a retried tape; the silence rule 4.9 s later on the drop and 4.7 s after message_stop on a full reply");

      // 10. Reset returns to the opening state, and the night replays the same way.
      t.click("reset");
      var v10a = st().now === -1 && rows() === 0 && t.stat("words") === 0 && st().rule === "close" && st().line === "drop";
      await t.run(3.5);
      var v10b = t.stat("words") === 8 && t.stat("stamp") === "DELIVERED" && t.stat("at") === 3.4 &&
        JSON.stringify(stream(cfg("drop", 8, "end_turn")).events) === JSON.stringify(st().run.events);
      t.expect(v10a && v10b, "reset returns to 23:47:00 before the first event, and the story plays out the same way again: 8 words, DELIVERED at 3.4 s");
    }
  });
})();
