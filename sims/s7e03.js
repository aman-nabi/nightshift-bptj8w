/* sims/s7e03-v1.0.0.js  (published as sims/s7e03.js)
   Case s7e03 "The Borrowed Key": a sign-in flow lab for Pomarine, a riverside restaurant whose
   booking app, built by Lusotti, lets guests sign in with Almanack, a calendar company. The
   learner replays Ms Quaranta's sign-in at 20:15 on 25 September and the night of 13 to 14
   October, and chooses the sign-in flow, how long a token lasts, its scope, whether page
   addresses are stripped before they go to analytics, and which return pages Almanack accepts.
   The widget shows each flow as numbered steps with where the token sits at each step, and the
   stats count where tokens went over five months and whether one still worked at 02:41.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: tokens are labels such as "token 3861",
   never real formats; there are no requests, no payloads and no tooling. Every count below is
   given data from the story, not computed from any rate.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: flow (old token-in-address, code flow, code flow with
     PKCE, our own passwords); token lifetime 30 days (as found) or 1 hour; scope full calendar
     (as found) or free and busy; strip page addresses before analytics off or on; return pages
     any of 38 (as found) or one exact page. Buttons: next event, run to 23:00 on 14 Oct, start
     again, reset. selfTest: 10 assertions.

   The model (stated in sim.lede, the post and the comments):
   - 12 May to 13 Oct: 4,300 sign-ins from 2,900 guests (given). Each sign-in hands the app a new
     token. In the old flow each token arrives in the page address.
   - Every page sends its address to the analytics tool (unless stripping is on); its reports are
     shared with an outside agency. The help chat on the return page keeps the page address with
     every chat: 212 chats since May, 40 of them in the 30 days before 02:41 on 14 Oct (given,
     OP's reply). Ms Quaranta never opened the chat.
   - Almanack's tokens last 30 days (as found). 860 sign-ins fell in the 30 days before 02:41 on
     14 Oct, none in the hour before it (given). So live in the reports at 02:41: 860 with
     30 days, 0 with 1 hour; live in the chat records: 40 with 30 days, 0 with 1 hour.
   - Ms Quaranta signed in at 20:15 on 25 Sep at table 6; her token is token 3861; our server
     read her calendar at 20:16. With 30 days it runs to 25 Oct, so at 02:41 on 14 Oct it had
     been in the reports 18 days with 11 left (about 18.3 and 11.7). With 1 hour it ran out at
     21:15 on 25 Sep.
   - 02:41 on 14 Oct: a read as Pomarine from a computer that isn't ours happens only if token 3861
     sits in the analytics reports (old flow, no stripping) and still works (30 days). Scope full:
     titles, places, times; scope free and busy: busy times only. 08:12: the text lists what the
     read could see.
   - Code flow (with or without PKCE): the address carries a one-time code, spent once by our
     server; 0 tokens in any address, report or chat record. PKCE ties each code to a secret made
     for that sign-in. Our own passwords: no Almanack token at all, no table times from diaries,
     2,900 passwords for Pomarine to store.
   - Return pages: prefix matching accepts any of our 38 pages whose address starts the same way
     (given); exact matching accepts 1. It changes no count on this night.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e03-v1.0.0.json):
   - 4,300 and 860 (the post); 212 and 40 (OP's reply); 2,900 and 38 (sim.lede).
   - 18 days and 11 left (the post): 25 Sep 20:15 to 14 Oct 02:41, of a 30-day lifetime.
   - Option outcomes: ok (PKCE) 0 in addresses, 0 in reports, no read; strip 0 in reports,
     4,300 in addresses, 212 in chat, 40 live; free and busy, read still happens, 860 live;
     own passwords 0 tokens, 2,900 passwords.
*/
(function () {
  "use strict";

  var SIGNINS = 4300;
  var GUESTS = 2900;
  var LIVE30 = 860;
  var CHATS = 212;
  var CHATS_LIVE = 40;
  var PREFIX_PAGES = 38;
  var FLOWS = [
    { value: "old", label: "Old way: token in the page address (as found)" },
    { value: "code", label: "Code flow" },
    { value: "pkce", label: "Code flow with PKCE" },
    { value: "own", label: "A password of our own (no Almanack)" }
  ];
  var LIFE = [
    { value: "30d", label: "30 days (as found)" },
    { value: "1h", label: "1 hour" }
  ];
  var SCOPE = [
    { value: "full", label: "Full calendar (as found)" },
    { value: "busy", label: "Free and busy times only" }
  ];
  var MATCH = [
    { value: "prefix", label: "Any of our 38 pages (as found)" },
    { value: "exact", label: "One exact page" }
  ];
  var CLOCK = ["25 Sep, 20:00", "25 Sep, 20:15", "14 Oct, 02:41", "14 Oct, 08:12", "14 Oct, 23:00"];
  var LAST = 4;

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }

  /* ---------- the counts (pure functions the display and self-tests read) ---------- */

  function oldFlow(C) { return C.flow === "old"; }
  function codeFlow(C) { return C.flow === "code" || C.flow === "pkce"; }
  function inAddress(C) { return oldFlow(C) ? SIGNINS : 0; }
  function inReports(C) { return oldFlow(C) && !C.strip ? SIGNINS : 0; }
  function liveReports(C) { return inReports(C) && C.life === "30d" ? LIVE30 : 0; }
  function inChat(C) { return oldFlow(C) ? CHATS : 0; }
  function liveChat(C) { return inChat(C) && C.life === "30d" ? CHATS_LIVE : 0; }
  function codes(C) { return codeFlow(C) ? fmt(SIGNINS) + ", all spent" : "none"; }
  function tied(C) { return C.flow === "pkce" ? "yes, by its secret" : (C.flow === "code" ? "no" : "no code"); }
  function canRead(C) {
    if (C.flow === "own") return "nothing, no token";
    return C.scope === "full" ? "titles, places, times" : "busy times only";
  }
  function pages(C) { return C.match === "exact" ? 1 : PREFIX_PAGES; }
  function passwords(C) { return C.flow === "own" ? fmt(GUESTS) : 0; }

  // What happens at 02:41 on 14 October.
  function at0241(C) {
    if (C.flow === "own") return "no read: no Almanack token";
    if (codeFlow(C)) return "no read: token 3861 never in an address";
    if (C.strip) return "no read: token 3861 not in the reports";
    if (C.life === "1h") return "refused: token 3861 ran out at 21:15 on 25 Sep";
    return C.scope === "full" ? "read her full calendar, not from our server" : "read her busy times, not from our server";
  }
  function read(C) { return oldFlow(C) && !C.strip && C.life === "30d"; }
  function text0812(C) {
    if (!read(C)) return "no text";
    return C.scope === "full" ? "her next three appointments, times and places" : "three busy times, no places";
  }

  /* ---------- the flow, as numbered steps with where the token sits ---------- */

  function flowSteps(C) {
    var ret = C.match === "exact" ? "our one exact return page" : "one of our 38 pages";
    if (C.flow === "own") {
      return [
        ["1", "The guest signs in with a password Pomarine keeps.", "no token: no Almanack"],
        ["2", "No calendar is read; no table times are suggested.", "no token"]
      ];
    }
    var first = C.flow === "pkce" ?
      ["1", "Our app makes up a secret for this sign-in and sends the guest to Almanack with a locked form of it.", "not made yet"] :
      ["1", "Our page sends the guest to Almanack.", "not made yet"];
    var rows = [first, ["2", "She signs in at Almanack and says yes.", "not made yet"]];
    if (oldFlow(C)) {
      rows.push(["3", "Almanack sends her back to " + ret + " with the token in the page address.", "address bar"]);
      rows.push(["4", "The page sends its address on." + (C.strip ? " Analytics gets it with the token stripped." : ""),
        C.strip ? "help-chat records (if a chat starts), browser history" : "analytics reports, help-chat records (if a chat starts), browser history"]);
      rows.push(["5", "Our server reads her calendar with the token.", "our server, and every copy above"]);
    } else {
      rows.push(["3", "Almanack sends her back to " + ret + " with a one-time code in the address.", "not in any address"]);
      rows.push(["4", C.flow === "pkce" ? "Our server swaps the code, showing the secret; Almanack checks it matches." :
        "Our server swaps the code for the token.", "server to server"]);
      rows.push(["5", "Our server reads her calendar with the token.", "our server only"]);
    }
    return rows;
  }

  /* ---------- the story ---------- */

  function newRun() { return { step: 0, at0241: "not yet", text: "not yet" }; }

  // Runs the next event; returns its log line and tone.
  function stepRun(S) {
    var C = S.C;
    var R = S.R;
    var line;
    var tone = "";
    R.step += 1;
    if (R.step === 1) {
      line = "25 Sep 20:15 Ms Quaranta signs in at table 6.";
      if (C.flow === "own") {
        line += " She uses a Pomarine password. No Almanack token; no table times from her diary.";
        tone = "warn";
      } else if (oldFlow(C)) {
        line += " Almanack sends her back with token 3861 in the page address." +
          (C.strip ? " Analytics gets the address with the token stripped." : " The address goes into the analytics reports.") +
          " 20:16 our server reads her calendar.";
        tone = C.strip ? "warn" : "bad";
      } else {
        line += " Almanack sends her back with a one-time code in the address. Our server swaps it for token 3861" +
          (C.flow === "pkce" ? ", showing this sign-in's secret," : "") +
          " directly with Almanack, and the code is spent. 20:16 our server reads her calendar.";
        tone = "ok";
      }
    } else if (R.step === 2) {
      R.at0241 = at0241(C);
      if (read(C)) {
        line = "14 Oct 02:41 a read as Pomarine with token 3861, from a computer that isn't ours: " +
          (C.scope === "full" ? "her full calendar." : "her busy times only.") +
          " Token 3861 had sat in the reports 18 days, with 11 left to run.";
        tone = "bad";
      } else {
        line = "14 Oct 02:41 " + R.at0241 + ".";
        tone = "ok";
      }
    } else if (R.step === 3) {
      R.text = text0812(C);
      line = read(C) ? "14 Oct 08:12 a text from an unknown number to Ms Quaranta: " + R.text + "." :
        "14 Oct 08:12 no text: nothing was read.";
      tone = read(C) ? "bad" : "ok";
    } else {
      line = "14 Oct 23:00 report: " + fmt(SIGNINS) + " sign-ins since 12 May. Tokens in page addresses: " + fmt(inAddress(C)) +
        "; in analytics reports: " + fmt(inReports(C)) + " (" + liveReports(C) + " still working); in help-chat records: " +
        inChat(C) + " (" + liveChat(C) + " still working).";
      tone = liveReports(C) + liveChat(C) > 0 ? "bad" : "ok";
    }
    return { txt: line, tone: tone };
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
    var head = el("p", "margin:0;font-size:12px;");
    var table = el("table", "width:100%;font-size:12px;border-collapse:collapse;");
    var foot = el("p", "margin:0;font-size:12px;");
    [head, table, foot].forEach(function (x) { box.appendChild(x); });
    api.root.appendChild(box);
    return { el: el, head: head, table: table, foot: foot };
  }

  function row(ui, cells, bold) {
    var tr = ui.el("tr");
    cells.forEach(function (c) { tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;vertical-align:top;", String(c))); });
    ui.table.appendChild(tr);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var R = S.R;
    var ui = S.ui;
    ui.head.textContent = "Flow: " + pick(FLOWS, C.flow).label + ". Token lifetime " + pick(LIFE, C.life).label.toLowerCase() +
      ". Scope: " + pick(SCOPE, C.scope).label.toLowerCase() + ". Analytics stripping " + (C.strip ? "on" : "off") +
      ". Return pages: " + pick(MATCH, C.match).label.toLowerCase() + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["step", "what happens", "where the token is"], true);
    flowSteps(C).forEach(function (r) { row(ui, r); });
    ui.foot.textContent = "Tonight: 02:41 " + R.at0241 + "; 08:12 " + R.text + ".";
    S.stat.now(CLOCK[R.step]);
    S.stat.signins(fmt(SIGNINS));
    S.stat.address(inAddress(C) ? fmt(inAddress(C)) : 0);
    S.stat.reports(inReports(C) ? fmt(inReports(C)) : 0);
    S.stat.live(liveReports(C));
    S.stat.chat(inChat(C));
    S.stat.livechat(liveChat(C));
    S.stat.codes(codes(C));
    S.stat.tied(tied(C));
    S.stat.reads(canRead(C));
    S.stat.pages(pages(C));
    S.stat.passwords(passwords(C));
    S.stat.at0241(R.at0241);
    S.stat.text(R.text);
    S.ctl.next.disable(R.step >= LAST);
    S.ctl.all.disable(R.step >= LAST);
  }

  function run(api, steps) {
    var S = api.state;
    var n = 0;
    while (S.R.step < LAST && n < steps) {
      var r = stepRun(S);
      api.log(r.txt, r.tone);
      n += 1;
    }
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    var C = S.C;
    S.R = newRun();
    api.log((why ? why + " " : "") + "25 Sep, 20:00, before Ms Quaranta signs in. Replayed as if built this way since 12 May: " +
      fmt(SIGNINS) + " sign-ins, " + fmt(inAddress(C)) + " tokens in page addresses, " + fmt(inReports(C)) +
      " in the analytics reports, " + inChat(C) + " in help-chat records." +
      (C.flow === "own" ? " " + fmt(GUESTS) + " guests need a Pomarine password." : ""), "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e03", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { flow: "old", life: "30d", scope: "full", strip: false, match: "prefix" };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      S.ctl.flow = api.control.select("flow", "Sign-in flow", FLOWS, "old", opt("flow", String));
      S.ctl.life = api.control.select("life", "How long a token lasts", LIFE, "30d", opt("life", String));
      S.ctl.scope = api.control.select("scope", "Scope: what a token may read", SCOPE, "full", opt("scope", String));
      S.ctl.strip = api.control.toggle("strip", "Strip page addresses before they go to analytics", false, opt("strip", bool));
      S.ctl.match = api.control.select("match", "Return pages Almanack accepts", MATCH, "prefix", opt("match", String));
      S.ctl.next = api.control.button("next", "Next event", function () { run(api, 1); });
      S.ctl.all = api.control.button("all", "Run to 23:00 on 14 Oct", function () { run(api, LAST); });
      S.ctl.again = api.control.button("again", "Start again", function () { restart(api, "New run."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        signins: api.stat("signins", "sign-ins, 12 May to 13 Oct", ""),
        address: api.stat("address", "tokens put in page addresses", "bad"),
        reports: api.stat("reports", "tokens copied into analytics reports", "bad"),
        live: api.stat("live", "of those, still working at 02:41", "bad"),
        chat: api.stat("chat", "tokens copied into help-chat records", "warn"),
        livechat: api.stat("livechat", "of those, still working at 02:41", "warn"),
        codes: api.stat("codes", "one-time codes in page addresses", ""),
        tied: api.stat("tied", "each code tied to its sign-in", "ok"),
        reads: api.stat("reads", "what token 3861 may read", ""),
        pages: api.stat("pages", "return pages Almanack accepts", ""),
        passwords: api.stat("passwords", "passwords Pomarine must store", ""),
        at0241: api.stat("at0241", "14 Oct, 02:41", "bad"),
        text: api.stat("text", "14 Oct, 08:12 text", "")
      };
      api.info("<strong>How to read it.</strong> The table walks the chosen sign-in flow step by step and says where the token sits at each step. The stats count, over the five months from 12 May, where tokens were copied and how many still worked at 02:41 on 14 October. Then the run plays Ms Quaranta's sign-in on 25 September and the night it was read. Every number is given data; tokens are labels, never real ones.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function S() { return t.api.state; }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 20:00 on 25 Sep, before her sign-in, as found.
      t.expect(t.stat("now") === "25 Sep, 20:00" && t.stat("signins") === "4,300" && t.stat("address") === "4,300" &&
        t.stat("reports") === "4,300" && t.stat("live") === 860 && t.stat("chat") === 212 && t.stat("livechat") === 40 &&
        t.stat("pages") === 38 && t.stat("at0241") === "not yet" && S().R.step === 0,
        "Opens at 25 Sep 20:00: 4,300 tokens in addresses and reports, 860 still working, 212 in chat (40 working)");

      // 2. 20:15: her sign-in puts token 3861 in the page address.
      t.click("next");
      t.expect(t.stat("now") === "25 Sep, 20:15" &&
        has("25 Sep 20:15 Ms Quaranta signs in at table 6. Almanack sends her back with token 3861 in the page address. The address goes into the analytics reports. 20:16 our server reads her calendar."),
        "20:15: token 3861 arrives in the page address and goes into the analytics reports");

      // 3. The record: 02:41 read, 08:12 text, 23:00 report.
      t.click("all");
      t.expect(t.stat("now") === "14 Oct, 23:00" && t.stat("at0241") === "read her full calendar, not from our server" &&
        t.stat("text") === "her next three appointments, times and places" && t.stat("reads") === "titles, places, times" &&
        has("Token 3861 had sat in the reports 18 days, with 11 left to run.") &&
        has("14 Oct 23:00 report: 4,300 sign-ins since 12 May. Tokens in page addresses: 4,300; in analytics reports: 4,300 (860 still working); in help-chat records: 212 (40 still working)."),
        "As found: 02:41 reads her full calendar with token 3861; 860 working tokens in the reports");

      // 4. Option 0 (ok): code flow with PKCE puts no token in any address; no read.
      t.set("flow", "pkce");
      var pk = t.stat("address") === 0 && t.stat("reports") === 0 && t.stat("chat") === 0 && t.stat("live") === 0 &&
        t.stat("codes") === "4,300, all spent" && t.stat("tied") === "yes, by its secret";
      t.click("all");
      t.expect(pk && t.stat("at0241") === "no read: token 3861 never in an address" && t.stat("text") === "no text" &&
        has("showing this sign-in's secret, directly with Almanack, and the code is spent."),
        "Code flow with PKCE: 0 tokens in addresses, reports or chat; codes tied to their sign-in; no read");

      // 5. Code flow without PKCE: no tokens in addresses, but codes are not tied.
      t.set("flow", "code");
      t.expect(t.stat("address") === 0 && t.stat("tied") === "no" && t.stat("live") === 0,
        "Code flow alone: 0 tokens in addresses, but the code is not tied to its sign-in");

      // 6. Option 1: strip analytics. Reports hold 0, but 4,300 still in addresses, 40 working in chat.
      t.set("flow", "old");
      t.set("strip", true);
      var st = t.stat("reports") === 0 && t.stat("live") === 0 && t.stat("address") === "4,300" &&
        t.stat("chat") === 212 && t.stat("livechat") === 40;
      t.click("all");
      t.expect(st && t.stat("at0241") === "no read: token 3861 not in the reports",
        "Stripping: 0 in the reports, but 4,300 still in addresses and 40 working tokens in the help chat");

      // 7. Option 2: free and busy. The read still happens; 860 still working.
      t.set("strip", false);
      t.set("scope", "busy");
      t.click("all");
      t.expect(t.stat("at0241") === "read her busy times, not from our server" && t.stat("live") === 860 &&
        t.stat("text") === "three busy times, no places" && t.stat("reads") === "busy times only",
        "Free and busy: 02:41 still reads, busy times only; 860 working tokens still in the reports");

      // 8. Option 3: our own passwords. No tokens, 2,900 passwords to store.
      t.set("scope", "full");
      t.set("flow", "own");
      t.click("all");
      t.expect(t.stat("passwords") === "2,900" && t.stat("address") === 0 && t.stat("reads") === "nothing, no token" &&
        t.stat("at0241") === "no read: no Almanack token",
        "Own passwords: no Almanack token anywhere, 2,900 passwords to store");

      // 9. One-hour tokens with the old flow: still copied, none working at 02:41.
      t.set("flow", "old");
      t.set("life", "1h");
      t.click("all");
      t.expect(t.stat("reports") === "4,300" && t.stat("live") === 0 && t.stat("livechat") === 0 &&
        t.stat("at0241") === "refused: token 3861 ran out at 21:15 on 25 Sep",
        "One-hour tokens: 4,300 still copied, 0 working at 02:41, token 3861 refused");

      // 10. Exact return page: 1 page instead of 38.
      t.set("life", "30d");
      t.set("match", "exact");
      t.expect(t.stat("pages") === 1 && t.stat("live") === 860,
        "Exact matching: Almanack accepts 1 return page, not 38");
    }
  });
})();
