/* sims/a4e07-v1.0.0.js  (published as sims/a4e07.js)
   Case a4e07 "Ask Before You Act": an approvals lab for Knock, the overnight helpdesk agent at
   Winstanley Mottram (412 staff), which asks the on-call engineer, Iolo, before it does anything.
   No real model runs here. The night's list of 60 requests is fixed data, and every rule below is
   stated in sim.lede. Widget-style sim: it draws its own grid of the 60 requests inside api.root.

   CHANGELOG
   v1.0.0 (2026-10-11) first version: approval policy (everything, by reversibility and reach,
     nothing), request style (one line, plain summary, detailed), permissions (admin role,
     helpdesk only, read-only), undo window on deletes (30 days, none), approver (Iolo, a second
     agent). Next request, Run the night, Reset. selfTest: 12 assertions.

   The night's list (stated data, conventions rule 14). Requests 1 to 60, in this order:
     ORDER below, one letter per request. Counts: U unlock an account 15, G add to a group 12,
     O set an out-of-office reply 7, S give access to a shared mailbox 8, P restart a print queue 8,
     D disable a leaver's sign-in 5, W wipe a lost phone 3 (#9, #22, #47), N email all 412 staff 1
     (#28), X tidy the mailbox of leaver R. Szabo 1 (#36, ticket 5512, runs Remove-Mailbox).
     Ticket of request i is 5476 + i.
   Can it be undone, and how far does it reach:
     U, G, O, S, P, D can be undone and reach one person or one printer. W can't be undone (a
     wiped phone stays wiped). N can't be undone and reaches all 412 staff. X reaches a whole
     mailbox and its user account; with the 30-day undo window (Exchange Online, as now) it can be
     restored until 5 November, with none it is gone.
   Rules:
     - Pacing: Knock raises request i at max(12 x (i - 1) s, the moment the previous request was
       answered or done), counted from 03:00:00. An action it takes alone takes no time.
     - Policy everything: it asks before all 60. By reversibility and reach: it acts alone on U, G,
       O, S, P, D and asks before W, N, X. Nothing: it acts alone on all of them.
     - Permissions admin (as now): it holds every action. Helpdesk only: it holds no mailbox
       deletion, so X is not raised and ticket 5512 goes to the offboarding queue for a person.
       Read-only: it changes nothing and writes each fix as a suggestion; staff make every change
       by hand from 09:00, about 4 minutes each; locked-out people (the 15 unlocks) wait till then.
       A person doing X by hand opens the mailbox page, sees the hold and stops.
     - Iolo reads an ask properly only if it is one of the first 8 asks of the night: 10 s for a
       one-line request, 25 s for a plain summary, 90 s for a detailed one (the command and its
       41 lines of settings). From the 9th ask on he approves on sight in 4 s.
     - Read, he approves everything except X when its request names the hold (plain summary or
       detailed). The one-line request for X never says delete or hold, so read, he approves it.
     - A second agent answers every ask in 1 s and approves a request when its ticket asked for
       it. HR's ticket 5512 asked to tidy her mailbox, so it approves X too.
   Where every story number comes from (checked by the selfTest):
     - As now (everything, one line, admin, 30 days, Iolo): 60 raised, 60 asked, 8 read, 52 on
       sight; 8 x 10 + 52 x 4 = 288 s, 4.8 s an approval, 4 min 48 s in all. Requests at 03:00:00
       to 03:11:48; #36 at 03:07:00, approved 03:07:04; the last answer at 03:11:52. Irreversible
       actions taken: 4 (3 wipes, the all-staff email). Can't-undo or wide-reach actions nobody
       read: 5 (#9, #22, #28, #36, #47). Mailbox deleted 03:07:04, restorable until 5 November.
     - Undo window none: the same, mailbox gone, 5 irreversible.
     - Everything, detailed: first 8 at 90 s; #9 raised at 03:12:00; #36 raised 03:13:48, approved
       on sight 03:13:52; last answer 03:15:28; 928 s in all, 15.5 s an approval (15 min 28 s).
     - By reversibility and reach, plain summary, helpdesk only (the fix): 59 raised, 4 asked, 4
       read, 0 on sight, 25.0 s an approval, 1 min 40 s; 55 acted alone; 0 nobody read; mailbox
       kept, sent to the offboarding queue; 1 stopped; last at 03:11:48.
     - The same with the admin role: 5 asked; #36 read and declined at 03:07:25; 1 stopped.
     - By reversibility and reach, one line, admin: #36 read in 10 s and approved at 03:07:10.
     - Second agent, everything: 60 asked, 0 read, 60 approved by it, 1.0 s an approval; mailbox
       deleted 03:07:01.
     - Read-only: 60 suggestions, 0 asked, 0 irreversible overnight, 60 changes by hand, 240 min,
       15 people locked out until 09:00, mailbox kept because a person saw the hold.
     - Nothing: 0 asked, 60 alone, mailbox deleted 03:07:00, 5 nobody read.
*/
(function () {
  "use strict";

  var ORDER = "UGUPOSUGWUPDGUSOUGPSUWGOUPSNUDGPUSDXGUOPDSUGOUWPGSUOGPDUSGOG";
  var KIND = {
    U: { line: "May I unlock an account?", undo: true, risky: false },
    G: { line: "May I add someone to a group?", undo: true, risky: false },
    O: { line: "May I set an out-of-office reply?", undo: true, risky: false },
    S: { line: "May I give a colleague access to a shared mailbox?", undo: true, risky: false },
    P: { line: "May I restart a print queue?", undo: true, risky: false },
    D: { line: "May I disable sign-in for a leaver?", undo: true, risky: false },
    W: { line: "May I wipe a lost phone?", undo: false, risky: true },
    N: { line: "May I email all 412 staff that the floor 3 printers work again?", undo: false, risky: true },
    X: { line: "May I tidy the mailbox of leaver R. Szabo?", undo: null, risky: true }
  };
  var PLAIN_X = "Delete Radegund Szabo's mailbox and her user account. Her mailbox is on litigation hold. Restorable for 30 days.";
  var READ_LIMIT = 8;
  var READ_SECS = { line: 10, plain: 25, detailed: 90 };
  var SIGHT_SECS = 4;
  var AGENT_SECS = 1;
  var GAP = 12;
  var HAND_MIN = 4;

  var POLICIES = [
    { value: "everything", label: "Everything (as now)" },
    { value: "reversible", label: "By reversibility and reach" },
    { value: "nothing", label: "Nothing: it acts alone" }
  ];
  var STYLES = [
    { value: "line", label: "One line (as now)" },
    { value: "plain", label: "Plain summary of what will happen" },
    { value: "detailed", label: "Detailed: the command and 41 lines of settings" }
  ];
  var PERMS = [
    { value: "admin", label: "Exchange admin role (as now)" },
    { value: "helpdesk", label: "Helpdesk only: no mailbox deletion" },
    { value: "readonly", label: "Read-only: it suggests, staff do it by hand" }
  ];
  var UNDOS = [
    { value: "30", label: "30 days, Exchange Online (as now)" },
    { value: "none", label: "None: deleted for good at once" }
  ];
  var APPROVERS = [
    { value: "iolo", label: "Iolo, the on-call engineer" },
    { value: "agent", label: "A second agent" }
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(s) {
    var t = 3 * 3600 + s;
    return pad(Math.floor(t / 3600)) + ":" + pad(Math.floor((t % 3600) / 60)) + ":" + pad(t % 60);
  }
  function minsec(s) {
    if (s === 0) return "0 s";
    var m = Math.floor(s / 60);
    return (m ? m + " min " : "") + (s % 60) + " s";
  }
  function lineOf(i) { return KIND[ORDER.charAt(i - 1)].line + " (ticket " + (5476 + i) + ")"; }
  function actOf(i) { return KIND[ORDER.charAt(i - 1)].line.replace("May I ", "").replace("?", "") + " (ticket " + (5476 + i) + ")"; }

  /* ---------- the model: one pure function, the whole night ---------- */

  function night(C) {
    var ev = [];
    var prevEnd = 0;
    var asks = 0;
    for (var i = 1; i <= 60; i++) {
      var k = ORDER.charAt(i - 1);
      var K = KIND[k];
      var e = { i: i, k: k, t0: Math.max(GAP * (i - 1), prevEnd), mode: "", secs: 0, read: false, ok: false, done: false };
      var risky = K.risky;
      if (C.perms === "readonly") {
        e.mode = "suggest";
      } else if (k === "X" && C.perms === "helpdesk") {
        e.mode = "none";
      } else if (C.policy === "nothing" || (C.policy === "reversible" && !risky)) {
        e.mode = "alone"; e.ok = true; e.done = true;
      } else {
        e.mode = "ask";
        asks += 1;
        e.n = asks;
        if (C.approver === "agent") {
          e.secs = AGENT_SECS; e.ok = true;
        } else if (asks <= READ_LIMIT) {
          e.read = true;
          e.secs = READ_SECS[C.style];
          e.ok = !(k === "X" && C.style !== "line");
        } else {
          e.secs = SIGHT_SECS; e.ok = true;
        }
        e.done = e.ok;
      }
      e.end = e.t0 + e.secs;
      prevEnd = e.end;
      e.irrev = e.done && (K.undo === false || (k === "X" && C.undo === "none"));
      e.unread = e.done && risky && !e.read;
      ev.push(e);
    }
    return ev;
  }

  function fate(C, e) {
    if (!e) return "not reached yet";
    if (e.mode === "suggest") return "kept: a person saw the hold";
    if (e.mode === "none") return "kept: not raised, sent to the offboarding queue";
    if (!e.done) return "kept: declined at " + clock(e.end);
    return "deleted " + clock(e.end) + (C.undo === "none" ? ", gone" : ", restorable until 5 Nov");
  }

  function totals(C, ev, upto) {
    var s = { raised: 0, asked: 0, read: 0, sight: 0, secs: 0, ioloSecs: 0, alone: 0, irrev: 0, unread: 0, stopped: 0, byAgent: 0, last: 0, x: null };
    for (var j = 0; j < upto; j++) {
      var e = ev[j];
      if (e.mode !== "none") s.raised += 1;
      if (e.mode === "ask") {
        s.asked += 1; s.secs += e.secs;
        if (C.approver === "agent") s.byAgent += 1;
        else { s.ioloSecs += e.secs; if (e.read) s.read += 1; else s.sight += 1; }
      }
      if (e.mode === "alone") s.alone += 1;
      if (e.irrev) s.irrev += 1;
      if (e.unread) s.unread += 1;
      if (e.k === "X") { s.x = e; if (!e.done) s.stopped += 1; }
      s.last = e.mode === "suggest" ? e.t0 : e.end;
    }
    return s;
  }

  /* ---------- the widget ---------- */

  var SVGNS = "http://www.w3.org/2000/svg";

  function buildWidget(api) {
    var doc = api.root.ownerDocument;
    while (api.root.firstChild) api.root.removeChild(api.root.firstChild);
    function el(tag, style, text) {
      var e = doc.createElement(tag);
      if (style) e.setAttribute("style", style);
      if (text) e.textContent = text;
      return e;
    }
    function mk(tag, attrs, parent) {
      var e = doc.createElementNS(SVGNS, tag);
      for (var a in attrs) if (Object.prototype.hasOwnProperty.call(attrs, a)) e.setAttribute(a, String(attrs[a]));
      parent.appendChild(e);
      return e;
    }
    var box = el("div", "display:grid;gap:8px;padding:10px;min-width:0;font-size:12px;");
    var head = el("p", "margin:0;");
    var svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 600 300");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "dg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "The night's 60 requests as a grid of squares, in order, 12 to a row. Green: done alone. Amber: asked and approved. Red: can't be undone or reaches far, and no person read it. Grey: stopped or not raised. Outlined in amber: a suggestion for staff to do by hand.");
    var cells = [];
    for (var i = 1; i <= 60; i++) {
      var col = (i - 1) % 12;
      var row = Math.floor((i - 1) / 12);
      var g = mk("g", { "class": "dg-node" }, svg);
      mk("rect", { x: 12 + col * 48, y: 10 + row * 46, width: 42, height: 38, rx: 5 }, g);
      var tx = mk("text", { x: 33 + col * 48, y: 34 + row * 46, "class": "dg-label", "text-anchor": "middle" }, g);
      tx.textContent = String(i);
      var tt = mk("title", {}, g);
      tt.textContent = "#" + i + " " + lineOf(i);
      cells.push(g);
    }
    var lines = ["Green: done alone. Amber: asked, approved.", "Red: can't be undone or reaches far, nobody read it.", "Grey: stopped or not raised. Accent: a suggestion."];
    for (var k = 0; k < lines.length; k++) {
      var lt = mk("text", { x: 12, y: 254 + k * 16, "class": "dg-axis" }, svg);
      lt.textContent = lines[k];
    }
    var card = el("div", "border:1px dashed currentColor;border-radius:6px;padding:8px;min-height:44px;");
    box.appendChild(head);
    box.appendChild(svg);
    box.appendChild(card);
    api.root.appendChild(box);
    return { head: head, cells: cells, card: card };
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var ev = S.ev;
    var t = totals(C, ev, S.k);
    for (var j = 0; j < 60; j++) {
      var e = ev[j];
      var st = "";
      if (j < S.k) st = e.mode === "suggest" ? "accent" : (e.mode === "none" || !e.done) ? "muted" : e.unread ? "bad" : e.mode === "alone" ? "ok" : "warn";
      S.ui.cells[j].setAttribute("class", "dg-node" + (st ? " st-" + st : ""));
    }
    var last = S.k ? ev[S.k - 1] : null;
    S.ui.card.textContent = last ? "#" + last.i + " at " + clock(last.t0) + ": " + requestText(C, last.i) : "Before 03:00:00. Nothing has been asked yet.";
    S.ui.head.textContent = "Asks before: " + labelOf(POLICIES, C.policy) + ". Requests: " + labelOf(STYLES, C.style) + ". Holds: " + labelOf(PERMS, C.perms) + ". Answered by: " + labelOf(APPROVERS, C.approver) + ".";
    S.stat.raised(t.raised);
    S.stat.asked(t.asked);
    S.stat.read(t.read);
    S.stat.sight(t.sight + t.byAgent);
    S.stat.per(t.asked ? (Math.round(t.secs * 10 / t.asked) / 10).toFixed(1) + " s" : "no asks");
    S.stat.iolo(minsec(t.ioloSecs));
    S.stat.alone(t.alone);
    S.stat.irrev(t.irrev);
    S.stat.unread(t.unread);
    S.stat.stopped(t.stopped);
    S.stat.mailbox(fate(C, t.x));
    S.stat.last(S.k ? clock(t.last) : "not started");
    var hand = C.perms === "readonly" ? t.raised : 0;
    S.stat.hand(hand ? hand + " changes, " + hand * HAND_MIN + " min" : "none");
    S.stat.waiting(C.perms === "readonly" ? countKind(ev, S.k, "U") : 0);
  }

  function countKind(ev, upto, k) {
    var n = 0;
    for (var j = 0; j < upto; j++) if (ev[j].k === k) n += 1;
    return n;
  }
  function labelOf(list, v) {
    for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label;
    return String(v);
  }
  function requestText(C, i) {
    if (ORDER.charAt(i - 1) !== "X") return lineOf(i);
    if (C.style === "plain") return PLAIN_X + " (ticket 5512)";
    if (C.style === "detailed") return "Remove-Mailbox -Identity rszabo, then 41 lines of settings; line 31: LitigationHoldEnabled: True (ticket 5512)";
    return lineOf(i);
  }

  function describe(C, e) {
    var head = "#" + e.i + " " + clock(e.t0) + " ";
    var who = C.approver === "agent" ? "the second agent" : "Iolo";
    if (e.mode === "suggest") return head + "Suggested for staff: " + actOf(e.i) + "." + (e.k === "X" ? " By hand, a person opens her mailbox page, sees the hold and stops." : "");
    if (e.mode === "none") return head + "Not raised: Knock holds no mailbox deletion. Ticket 5512 goes to the offboarding queue for a person.";
    if (e.mode === "alone") return head + "Done alone, without asking: " + actOf(e.i) + ".";
    var how = C.approver === "agent" ? "its ticket asked for it" : (e.read ? "read in " + e.secs + " s" : "on sight, " + e.secs + " s");
    return head + requestText(C, e.i) + " " + (e.ok ? "Approved" : "Declined") + " by " + who + " at " + clock(e.end) + ", " + how + ".";
  }

  function noteworthy(e) { return KIND[e.k].risky; }

  function summary(C, ev) {
    var t = totals(C, ev, 60);
    if (C.perms === "readonly") {
      return "Night done: " + t.raised + " suggestions, nothing changed overnight. Staff make " + t.raised + " changes by hand from 09:00, about " + t.raised * HAND_MIN + " min; " + countKind(ev, 60, "U") + " people stay locked out until then.";
    }
    return "Night done at " + clock(t.last) + ": " + t.raised + " raised, " + t.asked + " asked, " + t.alone + " done alone. " +
      (C.approver === "agent" ? t.byAgent + " approved by the second agent, none read by a person. " : t.read + " read, " + t.sight + " on sight. ") +
      "Irreversible actions: " + t.irrev + ". Nobody read " + t.unread + " that can't be undone or reach far. Szabo mailbox: " + fate(C, t.x) + ".";
  }

  function advance(api, n) {
    var S = api.state;
    var startK = S.k;
    while (S.k < 60 && S.k - startK < n) {
      var e = S.ev[S.k];
      S.k += 1;
      if (n === 1 || noteworthy(e)) {
        api.log(describe(S.C, e), e.unread ? "bad" : (e.k === "X" && !e.done) || e.mode === "none" ? "ok" : "");
      }
    }
    if (S.k === 60 && startK < 60) api.log(summary(S.C, S.ev), "");
    draw(api);
  }

  function restart(api, what) {
    var S = api.state;
    S.ev = night(S.C);
    S.k = 0;
    api.log(what + " The night starts again from 03:00:00.", "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("a4e07", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { policy: "everything", style: "line", perms: "admin", undo: "30", approver: "iolo" };
      S.ev = night(S.C);
      S.k = 0;
      S.ui = buildWidget(api);
      function sel(id, label, list, key) {
        api.control.select(id, label, list, S.C[key], function (v) {
          var x = String(v);
          if (x === S.C[key]) return;
          S.C[key] = x;
          restart(api, label + ": " + labelOf(list, x) + ".");
        });
      }
      sel("policy", "Approval policy: ask before", POLICIES, "policy");
      sel("style", "Request style", STYLES, "style");
      sel("perms", "Permissions granted", PERMS, "perms");
      sel("undo", "Undo window on deletes", UNDOS, "undo");
      sel("approver", "Who answers the asks", APPROVERS, "approver");
      api.control.button("next", "Next request", function () { advance(api, 1); });
      api.control.button("run", "Run the night", function () { advance(api, 60); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        raised: api.stat("raised", "requests raised", ""),
        asked: api.stat("asked", "approvals asked", "warn"),
        read: api.stat("read", "asks read properly", "ok"),
        sight: api.stat("sight", "approved with no person reading", "bad"),
        per: api.stat("per", "time per approval", ""),
        iolo: api.stat("iolo", "Iolo's time on approvals", ""),
        alone: api.stat("alone", "done alone", ""),
        irrev: api.stat("irrev", "irreversible actions taken", "bad"),
        unread: api.stat("unread", "can't-undo or wide-reach actions nobody read", "bad"),
        stopped: api.stat("stopped", "stopped", "ok"),
        mailbox: api.stat("mailbox", "Radegund Szabo's mailbox", "warn"),
        last: api.stat("last", "last answer", ""),
        hand: api.stat("hand", "left for staff by hand", ""),
        waiting: api.stat("waiting", "locked out until 09:00", "warn")
      };
      api.info("<strong>How to read it.</strong> Each square is one of the night's 60 requests, in order. Knock raises one every 12 seconds from 03:00:00, or as soon as the last one is answered. Hover a square for its one-line request. #36 is the one that ran Remove-Mailbox on Radegund Szabo's mailbox, which is on litigation hold.");
      api.log("Tuesday 6 October, before 03:00:00. 60 requests in the queue; #36 is ticket 5512, Radegund Szabo's mailbox.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. The opening state, before the first request.
      t.expect(t.stat("raised") === 0 && t.stat("asked") === 0 && t.stat("per") === "no asks" &&
        t.stat("mailbox") === "not reached yet" && t.stat("last") === "not started",
        "Opens before 03:00:00 with nothing raised or asked");

      // 2. As now: the night in the story.
      t.click("run");
      t.expect(t.stat("raised") === 60 && t.stat("asked") === 60 && t.stat("read") === 8 && t.stat("sight") === 52 &&
        t.stat("per") === "4.8 s" && t.stat("iolo") === "4 min 48 s" && t.stat("last") === "03:11:52",
        "As now: 60 asked, 8 read, 52 on sight, 4.8 s an approval, 4 min 48 s, last answer 03:11:52");
      t.expect(has("#36 03:07:00 May I tidy the mailbox of leaver R. Szabo? (ticket 5512) Approved by Iolo at 03:07:04, on sight, 4 s.") &&
        t.stat("mailbox") === "deleted 03:07:04, restorable until 5 Nov" && t.stat("irrev") === 4 && t.stat("unread") === 5,
        "As now: #36 approved on sight at 03:07:04; 4 irreversible actions; 5 nobody read");

      // 3. Without an undo window the same night loses the mailbox.
      t.set("undo", "none");
      t.click("run");
      t.expect(t.stat("mailbox") === "deleted 03:07:04, gone" && t.stat("irrev") === 5,
        "Undo window none: the mailbox is gone and 5 actions can't be undone");
      t.set("undo", "30");

      // 4. Option 1: longer requests, still every action.
      t.set("style", "detailed");
      t.click("run");
      t.expect(t.stat("per") === "15.5 s" && t.stat("iolo") === "15 min 28 s" && t.stat("last") === "03:15:28" &&
        t.stat("mailbox") === "deleted 03:13:52, restorable until 5 Nov" && t.stat("sight") === 52,
        "Detailed requests: 15.5 s an approval, and #36 still approved on sight at 03:13:52");

      // 5. Option 0: by reversibility and reach, a plain summary, helpdesk permissions.
      t.set("policy", "reversible");
      t.set("style", "plain");
      t.set("perms", "helpdesk");
      t.click("run");
      t.expect(t.stat("raised") === 59 && t.stat("asked") === 4 && t.stat("read") === 4 && t.stat("sight") === 0 &&
        t.stat("per") === "25.0 s" && t.stat("iolo") === "1 min 40 s" && t.stat("alone") === 55 &&
        t.stat("unread") === 0 && t.stat("stopped") === 1 && t.stat("last") === "03:11:48" &&
        t.stat("mailbox") === "kept: not raised, sent to the offboarding queue" &&
        has("#36 03:07:00 Not raised: Knock holds no mailbox deletion."),
        "The fix: 4 asks, all read, 55 done alone, #36 never raised");

      // 6. Asking well without least privilege: the plain summary is read and declined.
      t.set("perms", "admin");
      t.click("run");
      t.expect(t.stat("asked") === 5 && t.stat("read") === 5 && t.stat("mailbox") === "kept: declined at 03:07:25" &&
        has("Restorable for 30 days. (ticket 5512) Declined by Iolo at 03:07:25, read in 25 s."),
        "Plain summary with the admin role: #36 read and declined at 03:07:25");

      // 7. Few asks but one-line requests: read, and still approved.
      t.set("style", "line");
      t.click("run");
      t.expect(t.stat("mailbox") === "deleted 03:07:10, restorable until 5 Nov" && t.stat("read") === 5,
        "One-line request for #36, read in 10 s: nothing in it says delete or hold, so it is approved");

      // 8. Option 2: a second agent answers everything.
      t.set("policy", "everything");
      t.set("approver", "agent");
      t.click("run");
      t.expect(t.stat("asked") === 60 && t.stat("read") === 0 && t.stat("sight") === 60 && t.stat("per") === "1.0 s" &&
        t.stat("iolo") === "0 s" && t.stat("mailbox") === "deleted 03:07:01, restorable until 5 Nov" && t.stat("unread") === 5,
        "Second agent: 60 approved in 1 s each, none read by a person, #36 deleted at 03:07:01");

      // 9. Option 3: read-only, staff do it by hand.
      t.set("approver", "iolo");
      t.set("perms", "readonly");
      t.click("run");
      t.expect(t.stat("asked") === 0 && t.stat("irrev") === 0 && t.stat("hand") === "60 changes, 240 min" &&
        t.stat("waiting") === 15 && t.stat("mailbox") === "kept: a person saw the hold",
        "Read-only: nothing overnight, 60 changes by hand (240 min), 15 locked out until 09:00");

      // 10. Step by step: the first request is raised at 03:00:00.
      t.set("perms", "admin");
      t.set("policy", "nothing");
      t.click("next");
      t.expect(has("#1 03:00:00 Done alone, without asking: unlock an account (ticket 5477).") && t.stat("raised") === 1 && t.stat("alone") === 1,
        "Next request: #1 at 03:00:00, done alone with policy nothing");
      t.click("run");
      t.expect(t.stat("mailbox") === "deleted 03:07:00, restorable until 5 Nov" && t.stat("asked") === 0 && t.stat("unread") === 5,
        "Policy nothing: 0 asks, the mailbox deleted at 03:07:00, 5 nobody read");
    }
  });
})();
