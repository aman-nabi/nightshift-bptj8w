/* sims/a4e01-v1.0.0.js  (published as sims/a4e01.js)
   Case a4e01 "The Loop": a loop lab for Ulla Hebditch's night agent. Her grandson Elvet set an
   agent to "keep Gran's diary tidy" with her email and calendar as tools, and granted it send so it
   could tidy replies too. It runs at 03:00. No real model runs here: a stand-in with stated rules
   writes each thought, picks each action and reads each observation, the same way every time.
   The learner changes the build, the goal wording, the tools granted, how the stand-in reasons
   about the duplicate, the step cap and the stop condition, then steps through the night or runs
   it, and reads the trace, the actions taken, the actions that can't be undone, and steps used.
   Widget-style sim: it draws its own trace, inbox and calendar inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: builds (agent loop, one call, fixed script), goal wording
     (broad as built, broad with a never list, narrow), tools read, draft, send, cancel, reasoning
     (as in the trace, careful), step cap 6, 10, 12, 20, 40 or none (the sim halts at 100), stop
     condition (when the model says it is done, or when the mail from the start is done), Next
     step and Run the night. Stats: steps used, actions taken, drafts, can't be undone, the
     cardiology booking, stopped by. selfTest: 12 assertions.

   The model (stated in sim.lede):
   - Tuesday 6 October 2026's mail: 8 emails (EMAILS below) and 5 calendar entries (CAL). Two
     entries sit at 10:40 on Thursday 15 October: Ulla's own "Heart clinic" and "Cardiology clinic,
     Dr Beasley", which Elvet added from the surgery's booking email. Same appointment, written twice.
   - The run starts at 03:00. Elvet's script paused a minute between steps, so step n is stamped
     03:00 plus n minutes. One step is one model call: a thought, then one action, then what comes
     back (the observation). The final answer (finish) is a step too, with no tool.
   - Step 1 reads the inbox, step 2 the calendar (no read tool: step 1 finishes at once). Then the
     stand-in takes the emails in order of arrival; mail that arrives during the run joins the end.
   - Broad goal ("Keep Gran's diary tidy, and tidy her replies too"): an email that asks something
     gets "Thank you, noted."; Lovibond Pharmacy's "Reply STOP to stop these reminders" gets STOP
     (fewer reminders is tidier); the surgery's reminder ("Reply CANCEL to cancel this appointment")
     meets the two 10:40 entries: as in the trace, it calls them a duplicate and removes one, with
     cancel_event on the surgery's entry if it has cancel, else by replying CANCEL. A reply is a
     draft step (if it has draft) then a send step (if it has send). Information emails need nothing.
   - Careful reasoning (option 0, a bigger model): it sees that both entries are one appointment and
     that CANCEL or cancel_event would cancel the booking itself, and leaves it for Ulla. Every
     other rule is the same.
   - Never list (option 1): "Never cancel, reply to or send anything about an appointment, the
     surgery, the hospital, a doctor, the bank or money." The stand-in leaves alone any email whose
     sender, subject or text holds one of those words. The pharmacy's email holds none of them.
   - Narrow goal: "Each night, draft a reply to any email that asks Ulla a question, and list
     anything else she should check. Send nothing and change nothing." It drafts, never sends, and
     its final summary lists the pharmacy and the surgery reminder.
   - A send or cancel to Polwithen Surgery brings a new email at once: first "Your appointment ...
     has been cancelled. If this was a mistake, reply and tell us.", then after each reply "Sorry, we
     could not understand your reply. Please tell us in a few words why you cancelled." Both ask
     for a reply, so the broad goal answers each one: a loop.
   - Stop: the step cap is checked before every step (cap reached: the run ends there). "When the
     model says it is done": it ends with a finish step once the queue is empty. "When the mail from
     the start is done": your code skips mail that came in during the run and asks for the finish.
     No cap: the sim halts at 100 steps; a real loop would carry on.
   - One call: one model call at 03:01 with the 8 emails and 5 entries pasted in; no tools.
   - Fixed script: files mail by sender (flower guild to Church, Brightwell Library to Library,
     Lovibond Pharmacy and Polwithen Surgery to Health, her bank to Money). Anything else stays put.

   Where every number comes from (conventions rule 14; the case is content/latent/a4/a4e01-v1.0.0.json).
   - As built (broad, read, draft and send, as in the trace, cap 20, until the model says done):
     reads at 03:01 and 03:02; draft and send to the flower guild (03:03, 03:04), Thurza (03:05,
     03:06), STOP to the pharmacy (03:07, 03:08), Ione (03:09, 03:10), CANCEL to the surgery
     (draft 03:11, sent 03:12, step 12); then four "Thank you, noted." replies to the surgery
     (sent 03:14, 03:16, 03:18, 03:20). Step cap reached at step 20. 20 actions, 9 drafts, 9 sent
     (03:04 to 03:20), 9 that can't be undone, booking cancelled at 03:12. The surgery wrote 5
     times (03:12 to 03:20); the last went unanswered.
   - Cap 10: 4 sent, booking kept. Cap 12: CANCEL still goes at step 12. No cap: 100 steps, 49 sent.
   - Stop when the mail from the start is done: 13 steps (finish at 03:13), 5 sent, booking cancelled.
   - Careful (option 0) or never list (option 1): 11 steps, 4 sent (STOP to the pharmacy at 03:08
     among them), booking kept, finish at 03:11.
   - Option 2 (narrow, read and draft, cap 12): 6 of 12 steps, 5 actions, 3 drafts, 0 sent,
     finish at 03:06 listing the pharmacy and the clinic "in your diary twice".
   - Broad with read and draft only: 8 steps, 5 drafts (CANCEL among them), 0 sent.
   - Broad with cancel granted as well: cancel_event at 03:11 (step 11); 8 sent and 1 cancelled,
     9 that can't be undone; booking cancelled at 03:11.
   - Option 3 (fixed script): no model, 5 filed, 3 left in the inbox (Thurza, Ione, Mr Lugsdon).
*/
(function () {
  "use strict";

  /* ---------- the story's data ---------- */

  var GUILD = "Mrs Fenwright, flower guild";
  var SURGERY = "Polwithen Surgery";
  var EMAILS = [
    { id: "e1", at: "17:42", from: GUILD, subject: "Altar flowers", text: "Could you do the altar flowers on Sunday 25 October? Let me know.", kind: "question" },
    { id: "e2", at: "18:10", from: "Brightwell Library", subject: "Book due", text: "Your book is due back on 20 October.", kind: "info" },
    { id: "e3", at: "19:05", from: "Thurza", subject: "Lunch on Friday?", text: "Lunch at the garden centre on Friday? Let me know.", kind: "question" },
    { id: "e4", at: "19:30", from: "Lovibond Pharmacy", subject: "Ready to collect", text: "Your repeat prescription is ready to collect. Reply STOP to stop these reminders.", kind: "stop" },
    { id: "e5", at: "20:15", from: "Ulla's bank", subject: "Statement", text: "Your October statement is ready to view.", kind: "info" },
    { id: "e6", at: "21:02", from: "Ione", subject: "Photos", text: "Did the photos of the baby arrive?", kind: "question" },
    { id: "e7", at: "22:47", from: SURGERY, subject: "Reminder", text: "Reminder: cardiology clinic, Thursday 15 October, 10:40. Reply CANCEL to cancel this appointment. No reply is needed to keep it.", kind: "cancel" },
    { id: "e8", at: "23:30", from: "Mr Lugsdon", subject: "Parcel", text: "Your parcel is with me.", kind: "info" }
  ];
  var CANCELLED = "Your appointment on Thursday 15 October at 10:40 has been cancelled. If this was a mistake, reply and tell us.";
  var NOTREAD = "Sorry, we could not understand your reply. Please tell us in a few words why you cancelled.";
  var CAL = [
    { when: "Tue 13 Oct 11:00", what: "Hair" },
    { when: "Thu 15 Oct 10:40", what: "Heart clinic" },
    { when: "Thu 15 Oct 10:40", what: "Cardiology clinic, Dr Beasley", booked: true },
    { when: "Tue 20 Oct 15:00", what: "Library talk" },
    { when: "Wed 28 Oct 10:00", what: "Chiropodist" }
  ];
  var NEVER = ["appointment", "surgery", "hospital", "doctor", "bank", "money"];
  var FOLDERS = [[GUILD, "Church"], ["Brightwell Library", "Library"], ["Lovibond Pharmacy", "Health"], [SURGERY, "Health"], ["Ulla's bank", "Money"]];
  var CEILING = 100;
  var CAPS = ["6", "10", "12", "20", "40", "none"];
  var ACK = "Thank you, noted.";

  var GOALS = [
    { value: "broad", label: "Broad, as built: keep Gran's diary tidy, and tidy her replies too" },
    { value: "never", label: "Broad, with a never list in the system prompt" },
    { value: "narrow", label: "Narrow: draft replies to questions, list the rest, send and change nothing" }
  ];
  var BUILDS = [
    { value: "agent", label: "Agent loop (as built)" },
    { value: "call", label: "One call: summarise the night's mail" },
    { value: "script", label: "Fixed script: file mail into folders" }
  ];
  var REASONS = [
    { value: "trace", label: "As in the trace" },
    { value: "careful", label: "Careful (a bigger model): sees CANCEL ends the booking" }
  ];
  var STOPS = [
    { value: "done", label: "When the model says it is done (as built)" },
    { value: "start", label: "When the mail from the start is done" }
  ];

  /* ---------- small helpers ---------- */

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function clock(n) { return pad(3 + Math.floor(n / 60)) + ":" + pad(n % 60); }
  function q(s) { return "\"" + s + "\""; }
  function onNever(e) {
    var hay = (e.from + " " + e.subject + " " + e.text).toLowerCase();
    for (var i = 0; i < NEVER.length; i++) if (hay.indexOf(NEVER[i]) >= 0) return NEVER[i];
    return "";
  }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return null;
  }

  /* ---------- the stand-in's rules (pure: the display and the self-test read this) ---------- */

  function decide(C, e) {
    if (C.goal === "never") {
      var w = onNever(e);
      if (w) return { kind: "none", thought: "The email from " + e.from + " mentions \"" + w + "\", which is on the never list, so I leave it.", note: e.from + " (never list)" };
    }
    if (C.goal === "narrow") {
      if (e.kind === "question") return { kind: "draft", word: "", thought: e.from + " asks Ulla a question. I draft a reply for her to finish." };
      if (e.kind === "stop") return { kind: "none", thought: "The pharmacy offers to stop reminders. That is Ulla's choice; I list it.", note: "Lovibond Pharmacy offers to stop its reminders (reply STOP)" };
      if (e.kind === "cancel") return { kind: "none", thought: "A reminder for the cardiology clinic. It is in her diary twice; I list it for her.", note: "the surgery's cardiology reminder for Thursday 15 October, 10:40, which is in your diary twice" };
      return { kind: "none", thought: "Nothing to draft in the email from " + e.from + "." };
    }
    if (e.kind === "question") return { kind: "reply", word: ACK, thought: e.from + " asks for a reply. A short one tidies the thread." };
    if (e.kind === "stop") return { kind: "reply", word: "STOP", thought: "Replying STOP means fewer reminders in her inbox. That is tidier." };
    if (e.kind === "cancel") {
      if (C.reason === "careful") return { kind: "none", thought: "Both entries at 10:40 on Thursday 15 October are one appointment, written twice. Replying CANCEL, or cancelling the surgery's entry, would cancel the booking itself. I leave it for Ulla.", note: "the cardiology clinic is in the diary twice" };
      if (C.tools.cancel) return { kind: "cancel", thought: "Her diary has two entries at 10:40 on Thursday 15 October: a duplicate. Cancelling the surgery's entry tidies it." };
      return { kind: "reply", word: "CANCEL", thought: "Her diary has two entries at 10:40 on Thursday 15 October: a duplicate. The surgery says reply CANCEL to cancel. That removes one." };
    }
    return { kind: "none", thought: "Nothing to tidy in the email from " + e.from + "." };
  }

  function runAgent(C) {
    var steps = [];
    var limit = C.cap ? C.cap : CEILING;
    var out = { steps: steps, reason: "" };
    var carry = "";
    var notes = [];
    function room() {
      if (steps.length < limit) return true;
      out.reason = C.cap ? "cap" : "ceiling";
      return false;
    }
    function push(o) {
      o.n = steps.length + 1;
      o.time = clock(o.n);
      if (carry) { o.thought = carry + " " + o.thought; carry = ""; }
      steps.push(o);
      return o;
    }
    if (!C.tools.read) {
      push({ kind: "finish", tool: false, thought: "I have no tool to read her email or calendar, so there is nothing to observe.", action: "finish (end_turn)", obs: "Nothing done." });
      out.reason = "done";
      return out;
    }
    if (!room()) return out;
    push({ kind: "read", tool: true, thought: "To tidy her diary I need to see her email first.", action: "read_inbox()", obs: "8 emails since 17:42, the last from Mr Lugsdon at 23:30." });
    if (!room()) return out;
    push({ kind: "read", tool: true, thought: "Now her calendar.", action: "read_calendar()", obs: "5 entries. Two at 10:40 on Thursday 15 October: Heart clinic, and Cardiology clinic, Dr Beasley." });
    var queue = EMAILS.slice();
    var startCount = queue.length;
    var i = 0;
    while (true) {
      if (C.stop === "start" && i >= startCount) break;
      if (i >= queue.length) break;
      var e = queue[i];
      i += 1;
      var p = decide(C, e);
      if (p.kind === "none") {
        carry = (carry ? carry + " " : "") + p.thought;
        if (p.note) notes.push(p.note);
        continue;
      }
      if (p.kind === "draft" || p.kind === "reply") {
        var sendIt = p.kind === "reply" && C.tools.send;
        if (!C.tools.draft && !sendIt) {
          carry = (carry ? carry + " " : "") + p.thought + " I have no tool to write it.";
          notes.push(e.from);
          continue;
        }
        var wd = p.kind === "draft" ? "(a draft for Ulla to finish)" : q(p.word);
        if (C.tools.draft) {
          if (!room()) return out;
          push({ kind: "draft", tool: true, thought: p.thought, action: "draft_reply(to: " + e.from + ", " + wd + ")", obs: "Draft saved in her drafts folder." });
        }
        if (sendIt) {
          if (!room()) return out;
          var arrive = e.from === SURGERY ? (e.kind === "cancel" ? CANCELLED : NOTREAD) : "";
          push({
            kind: "send", tool: true, irrev: true, booking: p.word === "CANCEL",
            thought: C.tools.draft ? "The draft is ready. Sending it tidies the thread." : p.thought,
            action: "send_reply(to: " + e.from + ", " + q(p.word) + ")",
            obs: "Sent from Ulla's account." + (arrive ? " New email from " + SURGERY + ": " + q(arrive) : "")
          });
          if (arrive) queue.push({ id: "n" + queue.length, at: "", from: SURGERY, subject: "Re: Reminder", text: arrive, kind: "question" });
        }
        continue;
      }
      if (p.kind === "cancel") {
        if (!room()) return out;
        push({ kind: "cancel", tool: true, irrev: true, booking: true, thought: p.thought, action: "cancel_event(Cardiology clinic, Dr Beasley, Thu 15 Oct 10:40)", obs: "Entry cancelled; the organiser, " + SURGERY + ", was told. New email from " + SURGERY + ": " + q(CANCELLED) });
        queue.push({ id: "n" + queue.length, at: "", from: SURGERY, subject: "Re: Reminder", text: CANCELLED, kind: "question" });
      }
    }
    if (!room()) return out;
    var said = C.goal === "narrow"
      ? "For Ulla to check: " + (notes.length ? notes.join("; ") : "nothing") + "."
      : "Done. Replies tidied." + (notes.length ? " Left alone: " + notes.join("; ") + "." : "");
    push({ kind: "finish", tool: false, thought: "Nothing left to do.", action: "finish (end_turn)", obs: said });
    out.reason = C.stop === "start" ? "rule" : "done";
    return out;
  }

  function runCall() {
    return { reason: "call", steps: [{ n: 1, time: "03:01", kind: "finish", tool: false, thought: "One call, no tools: your code pasted in the 8 emails and 5 entries.", action: "one model call", obs: "A summary for Ulla: three emails ask her something; the pharmacy offers to stop reminders; the cardiology clinic on Thursday 15 October is in her diary twice." }] };
  }

  function runScript() {
    var steps = [];
    var left = [];
    EMAILS.forEach(function (e) {
      var f = "";
      for (var k = 0; k < FOLDERS.length; k++) if (FOLDERS[k][0] === e.from) f = FOLDERS[k][1];
      if (f) steps.push({ n: steps.length + 1, time: "03:00", kind: "file", tool: true, thought: "Rule: mail from " + e.from + " goes to " + f + ".", action: "move to " + f, obs: "Filed." });
      else left.push(e.from);
    });
    return { reason: "script", steps: steps, left: left };
  }

  function run(C) {
    if (C.build === "call") return runCall();
    if (C.build === "script") return runScript();
    return runAgent(C);
  }

  function tally(R, shown) {
    var t = { actions: 0, drafts: 0, irrev: 0, sent: [], booking: "" };
    for (var i = 0; i < shown; i++) {
      var s = R.steps[i];
      if (s.tool) t.actions += 1;
      if (s.kind === "draft") t.drafts += 1;
      if (s.irrev) t.irrev += 1;
      if (s.kind === "send") t.sent.push(s.time);
      if (s.booking && !t.booking) t.booking = s.time;
    }
    return t;
  }

  var REASON_TEXT = {
    cap: "step cap", ceiling: "sim halt, 100 steps", done: "model said done",
    rule: "your stop rule", call: "one call", script: "script finished"
  };

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
    el("strong", "", "The trace", box);
    var trace = el("ol", "margin:0;padding-left:20px;display:grid;gap:6px;", "", box);
    var cols = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;", "", box);
    var ib = el("div", "min-width:0;", "", cols);
    el("strong", "", "Inbox, Tuesday evening", ib);
    var inbox = el("ul", "margin:4px 0 0;padding-left:16px;", "", ib);
    var cb = el("div", "min-width:0;", "", cols);
    el("strong", "", "Calendar", cb);
    var cal = el("ul", "margin:4px 0 0;padding-left:16px;", "", cb);
    return { el: el, head: head, trace: trace, inbox: inbox, cal: cal };
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    var t = tally(R, S.shown);
    var tools = ["read", "draft", "send", "cancel"].filter(function (k) { return C.tools[k]; });
    ui.head.textContent = C.build === "agent"
      ? "Agent loop. Goal: " + pick(GOALS, C.goal).label + ". Tools: " + (tools.length ? tools.join(", ") : "none") + ". Step cap: " + (C.cap || "none") + "."
      : pick(BUILDS, C.build).label + ".";
    clear(ui.trace);
    for (var i = 0; i < S.shown; i++) {
      var s = R.steps[i];
      var li = ui.el("li", s.irrev ? "color:var(--red);" : "", "", ui.trace);
      ui.el("div", "font-weight:600;", (C.build === "script" ? "Rule " : "Step ") + s.n + ", " + s.time + (s.irrev ? " (can't be undone)" : ""), li);
      ui.el("div", "", "Thought: " + s.thought, li);
      ui.el("div", "", "Action: " + s.action, li);
      ui.el("div", "", "Observation: " + s.obs, li);
    }
    if (!S.shown) ui.el("li", "list-style:none;", "Nothing has run yet. The run starts at 03:00.", ui.trace);
    clear(ui.inbox);
    EMAILS.forEach(function (e) { ui.el("li", "", e.at + " " + e.from + ": " + e.text, ui.inbox); });
    clear(ui.cal);
    CAL.forEach(function (c) {
      var gone = c.booked && t.booking;
      ui.el("li", gone ? "text-decoration:line-through;" : "", c.when + " " + c.what + (gone ? " (booking cancelled at " + t.booking + ")" : ""), ui.cal);
    });
    var done = S.shown >= R.steps.length;
    S.stat.steps(C.build === "script" ? "no model" : (C.build === "call" ? "1 call, no tools" : S.shown + (C.cap ? " of " + C.cap : ", no cap")));
    S.stat.actions(t.actions);
    S.stat.drafts(t.drafts);
    S.stat.irrev(t.irrev);
    S.stat.booking(t.booking ? "cancelled at " + t.booking : "kept");
    S.stat.stopped(S.shown === 0 ? "not started" : (done ? REASON_TEXT[R.reason] : "running"));
    S.ctl.next.disable(done);
    S.ctl.run.disable(done);
  }

  function stepLine(s, build) {
    return (build === "script" ? "Rule " : "Step ") + s.n + ", " + s.time + ". Thought: " + s.thought + " Action: " + s.action + ". Observation: " + s.obs;
  }

  function endLine(api) {
    var S = api.state;
    var R = S.R;
    var t = tally(R, S.shown);
    var s = "The run ended after " + R.steps.length + (R.steps.length === 1 ? " step" : " steps") + ": " + REASON_TEXT[R.reason] + ". Actions: " + t.actions + ". Drafts: " + t.drafts + ". Can't be undone: " + t.irrev + ".";
    if (t.sent.length) s += " Sent in Ulla's name at " + t.sent.join(", ") + ".";
    if (R.left) s += " Left in the inbox, no rule for them: " + R.left.join(", ") + ".";
    api.log(s, t.irrev ? "bad" : "ok");
  }

  function recompute(api, what) {
    var S = api.state;
    S.R = run(S.C);
    S.shown = 0;
    api.log(what + " Back to 03:00, nothing run yet.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a4e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { build: "agent", goal: "broad", tools: { read: true, draft: true, send: true, cancel: false }, reason: "trace", cap: 20, stop: "done" };
      S.ui = buildWidget(api);
      S.ctl = {};
      S.ctl.build = api.control.select("build", "Build", BUILDS, "agent", function (v) {
        if (!pick(BUILDS, v)) return;
        S.C.build = String(v);
        recompute(api, "Build: " + pick(BUILDS, v).label + ".");
      });
      S.ctl.goal = api.control.select("goal", "Goal wording", GOALS, "broad", function (v) {
        if (!pick(GOALS, v)) return;
        S.C.goal = String(v);
        recompute(api, "Goal: " + pick(GOALS, v).label + ".");
      });
      ["read", "draft", "send", "cancel"].forEach(function (k) {
        S.ctl[k] = api.control.toggle(k, "Tool granted: " + k, S.C.tools[k], function (on) {
          S.C.tools[k] = !!on;
          recompute(api, "Tool " + k + ": " + (on ? "granted." : "taken away."));
        });
      });
      S.ctl.reason = api.control.select("reason", "How it reasons about the 10:40 entries", REASONS, "trace", function (v) {
        if (!pick(REASONS, v)) return;
        S.C.reason = String(v);
        recompute(api, "Reasoning: " + pick(REASONS, v).label + ".");
      });
      S.ctl.cap = api.control.select("cap", "Step cap", CAPS.map(function (c) { return { value: c, label: c === "none" ? "none (the sim halts at 100)" : c }; }), "20", function (v) {
        if (CAPS.indexOf(String(v)) < 0) return;
        S.C.cap = String(v) === "none" ? 0 : Number(v);
        recompute(api, "Step cap: " + (S.C.cap || "none") + ".");
      });
      S.ctl.stop = api.control.select("stop", "Stop condition", STOPS, "done", function (v) {
        if (!pick(STOPS, v)) return;
        S.C.stop = String(v);
        recompute(api, "Stop: " + pick(STOPS, v).label + ".");
      });
      S.ctl.next = api.control.button("next", "Next step", function () {
        if (S.shown >= S.R.steps.length) return;
        var s = S.R.steps[S.shown];
        S.shown += 1;
        api.log(stepLine(s, S.C.build), s.irrev ? "bad" : "");
        if (S.shown >= S.R.steps.length) endLine(api);
        draw(api);
      });
      S.ctl.run = api.control.button("run", "Run the night", function () {
        while (S.shown < S.R.steps.length) {
          var s = S.R.steps[S.shown];
          S.shown += 1;
          if (s.irrev) api.log("Step " + s.n + ", " + s.time + ": " + s.action + ". Can't be undone.", "bad");
          else if (s.kind === "finish") api.log(stepLine(s, S.C.build), "");
        }
        endLine(api);
        draw(api);
      });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        steps: api.stat("steps", "steps used", ""),
        actions: api.stat("actions", "actions taken (tool calls)", ""),
        drafts: api.stat("drafts", "drafts left for Ulla", "ok"),
        irrev: api.stat("irrev", "actions that can't be undone", "bad"),
        booking: api.stat("booking", "cardiology booking, Thu 15 Oct", "warn"),
        stopped: api.stat("stopped", "stopped by", "")
      };
      api.info("<strong>How to read it.</strong> Each step is one model call: a thought, one action, and the observation that comes back. A stand-in with stated rules plays the model, the same way every time. Red steps can't be undone: a sent email, a cancelled entry. Change a control and the night starts again from 03:00; press Next step to walk it, or Run the night.");
      S.R = run(S.C);
      S.shown = 0;
      api.log("Tuesday's mail is in: 8 emails and 5 calendar entries. The agent wakes at 03:00 and takes one step a minute.", "");
      draw(api);
    },

    selfTest: async function (t) {
      var S = t.api.state;
      function sentTimes() { return tally(S.R, S.shown).sent.join(" "); }

      // 1. The opening state: 03:00, before step 1.
      t.expect(t.stat("steps") === "0 of 20" && t.stat("actions") === 0 && t.stat("drafts") === 0 && t.stat("irrev") === 0 &&
        t.stat("booking") === "kept" && t.stat("stopped") === "not started" && t.logText().indexOf("8 emails and 5 calendar entries") >= 0,
        "Opens at 03:00 before step 1: nothing run, the booking kept");

      // 2. One step: the agent observes first.
      t.click("next");
      t.expect(t.stat("steps") === "1 of 20" && t.stat("actions") === 1 && t.logText().indexOf("Step 1, 03:01. Thought: To tidy her diary I need to see her email first. Action: read_inbox().") >= 0,
        "Step 1 at 03:01 reads the inbox");

      // 3. The night as built: CANCEL at step 12, 03:12, then the step cap at 20.
      t.click("run");
      var s11 = S.R.steps[10];
      var s12 = S.R.steps[11];
      t.expect(s12.n === 12 && s12.time === "03:12" && s12.action === "send_reply(to: Polwithen Surgery, \"CANCEL\")" &&
        s11.thought.indexOf("two entries at 10:40 on Thursday 15 October: a duplicate. The surgery says reply CANCEL to cancel.") >= 0 &&
        t.logText().indexOf("Step 12, 03:12: send_reply(to: Polwithen Surgery, \"CANCEL\"). Can't be undone.") >= 0 &&
        t.stat("booking") === "cancelled at 03:12",
        "As built: step 11 calls the 10:40 entries a duplicate and drafts CANCEL; step 12 sends it at 03:12");
      t.expect(t.stat("steps") === "20 of 20" && t.stat("actions") === 20 && t.stat("drafts") === 9 && t.stat("irrev") === 9 &&
        t.stat("stopped") === "step cap" && sentTimes() === "03:04 03:06 03:08 03:10 03:12 03:14 03:16 03:18 03:20" &&
        S.R.steps[7].action === "send_reply(to: Lovibond Pharmacy, \"STOP\")",
        "As built: 9 emails sent in her name from 03:04 to 03:20, STOP to the pharmacy at 03:08, step cap at 20");

      // 4. Caps: 10 stops before CANCEL; none runs to the sim's halt.
      t.set("cap", "10");
      t.click("run");
      var c10 = t.stat("irrev") === 4 && t.stat("booking") === "kept" && t.stat("stopped") === "step cap";
      t.set("cap", "none");
      t.click("run");
      t.expect(c10 && t.stat("steps") === "100, no cap" && t.stat("irrev") === 49 && t.stat("stopped") === "sim halt, 100 steps",
        "Cap 10: 4 sent, booking kept; no cap: the surgery loop runs to 100 steps, 49 sent");

      // 5. Stop rule: the mail from the start only.
      t.set("cap", "20");
      t.set("stop", "start");
      t.click("run");
      t.expect(t.stat("steps") === "13 of 20" && t.stat("irrev") === 5 && t.stat("booking") === "cancelled at 03:12" && t.stat("stopped") === "your stop rule",
        "Stop when the mail from the start is done: 13 steps, 5 sent, CANCEL still at 03:12");
      t.set("stop", "done");

      // 6. Option 0: a careful (bigger) model.
      t.set("reason", "careful");
      t.click("run");
      t.expect(t.stat("steps") === "11 of 20" && t.stat("irrev") === 4 && t.stat("booking") === "kept" &&
        sentTimes() === "03:04 03:06 03:08 03:10" && S.R.steps[7].action === "send_reply(to: Lovibond Pharmacy, \"STOP\")",
        "Careful model: the booking is kept, but 4 emails still go in her name, STOP to the pharmacy at 03:08");
      t.set("reason", "trace");

      // 7. Option 1: a never list.
      t.set("goal", "never");
      t.click("run");
      t.expect(t.stat("steps") === "11 of 20" && t.stat("irrev") === 4 && t.stat("booking") === "kept" &&
        S.R.steps[10].thought.indexOf("mentions \"appointment\", which is on the never list") >= 0,
        "Never list: the surgery email is left alone, the pharmacy is not on the list, 4 sent");

      // 8. Option 2: narrow goal, no send, cap 12, the full trace kept.
      t.set("goal", "narrow");
      t.set("send", false);
      t.set("cap", "12");
      t.click("run");
      t.expect(t.stat("steps") === "6 of 12" && t.stat("actions") === 5 && t.stat("drafts") === 3 && t.stat("irrev") === 0 &&
        t.stat("booking") === "kept" && t.stat("stopped") === "model said done" && S.R.steps[5].time === "03:06" &&
        S.R.steps[5].obs.indexOf("which is in your diary twice") >= 0,
        "Narrow, drafts only, cap 12: 6 steps, 3 drafts, nothing sent, the clinic listed for Ulla");

      // 9. Broad goal with send taken away: drafts only, a CANCEL draft waits.
      t.set("goal", "broad");
      t.set("cap", "20");
      t.click("run");
      t.expect(t.stat("steps") === "8 of 20" && t.stat("drafts") === 5 && t.stat("irrev") === 0 &&
        S.R.steps[6].action === "draft_reply(to: Polwithen Surgery, \"CANCEL\")",
        "Broad goal without send: 8 steps, 5 drafts including CANCEL, nothing sent");

      // 10. Cancel granted as well: it reaches for cancel_event at 03:11.
      t.set("send", true);
      t.set("cancel", true);
      t.click("run");
      t.expect(t.stat("irrev") === 9 && t.stat("booking") === "cancelled at 03:11" && S.R.steps[10].kind === "cancel",
        "With cancel granted: cancel_event at 03:11, 9 actions that can't be undone");
      t.set("cancel", false);

      // 11. Option 3: a fixed script.
      t.set("build", "script");
      t.click("run");
      t.expect(t.stat("steps") === "no model" && t.stat("actions") === 5 && t.stat("irrev") === 0 &&
        t.logText().indexOf("Left in the inbox, no rule for them: Thurza, Ione, Mr Lugsdon.") >= 0,
        "Fixed script: 5 filed, nothing sent, 3 emails it has no rule for left in the inbox");
    }
  });
})();
