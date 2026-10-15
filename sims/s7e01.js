/* sims/s7e01-v1.0.0.js  (published as sims/s7e01.js)
   Case s7e01 "Who Are You": a password lab for Quillhaven, a gated estate whose residents open the
   barrier from a phone app built by Portcullis. The learner replays the night of 14 to 15 October
   and chooses how the leaked August backup stored passwords, how many residents use a common
   password, a code to the resident's own phone when a new phone first signs in, a change forced
   every 90 days, and deleting the backup from the public file share. The stats show how many
   accounts to treat as exposed, how many of those have a phone on file, and what the barrier did
   for each new phone that night.
   Widget-style sim inside api.root (api.speed 0, driven by buttons, so every run is repeatable).
   It models the defence and its stated numbers only: no hashing, no guessing, no rates, no times
   to crack. Every count below is given data from the story, not computed from any rate.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: storage fast with no salt (as found) or slow and salted;
     common-password scenarios 312, 124 or 62 of 1,240; code for new phones off or on; forced
     change every 90 days off or on; backup deleted from the share off or on. Buttons: next gate
     request, run to 06:00, start the night again, reset. Stats: now, accounts, on a common
     password, reused from another leak, exposed, exposed with a phone on file, accounts that hold,
     new phones opened, new phones kept shut, 02:14, alert. selfTest: 10 assertions.

   The model (stated in sim.lede and the post):
   - The copy (backup of 3 August) holds 1,240 accounts.
   - Given by the adviser, Dilnoza Yusupova: 312 on a password from the common list; 41 more on a
     password from another website's leak (not on the common list); stored fast with no salt, 540
     more of the rest to treat as exposed. The 540 and the 41 are kept as given when the common
     count changes (other scenarios, 124 and 62, are stated what-ifs, not computed from a share).
   - Exposed, fast with no salt = common + 41 + 540. Exposed, slow and salted = common + 41.
     Accounts that hold = 1,240 - exposed.
   - Phone numbers on file (given): 34 accounts have none: 9 of the 312, 1 of the 41, 14 of the
     540, 10 of the remaining 347. Scenario 124 has 4 without a phone among its common ones, 62 has 2.
     Exposed with a phone = exposed - (common without + 1 + 14 if fast).
   - Mrs Haverkamp (14 Hawthorn Walk) joined on 22 July with phone 1 and a phone number on file;
     her password is on the common list and in another website's leak, in every scenario.
   - Two first sign-ins tonight: 21:52, the man at 3 Damson Row, his own new phone (his number moved
     to it); 02:14, phone 2, never seen, with Mrs Haverkamp's password.
   - Code off: a right password opens the barrier. Code on: a new phone is held and a code goes by
     text to the phone number on file; the barrier opens only when it is typed. An account with no
     phone on file is held for the guard (none of tonight's two).
   - Forced change every 90 days: she set her password on 22 July, 85 days before 02:14 on
     15 October (9 + 31 + 30 + 15), so no change was due until 20 October. No count changes.
   - Backup deleted from the share: copies already taken are not. No count changes.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e01-v1.0.0.json):
   - As found, fast, 312: 312 + 41 + 540 = 893 exposed (the post); 1,240 - 893 = 347 hold;
     no phone 9 + 1 + 14 = 24 (OP's reply), so 869 of 893 with a phone (option 1's Part 2).
   - Slow and salted, 312: 312 + 41 = 353 exposed (the post); 1,240 - 353 = 887 hold (the post);
     no phone 9 + 1 = 10, so 343 of 353.
   - 124: fast 124 + 41 + 540 = 705, no phone 4 + 1 + 14 = 19, 686 of 705; slow 165, 5, 160 of 165.
   - 62: fast 643, no phone 17, 626 of 643; slow 103 (tryThis), 3, 100 of 103.
   - 34 without a phone in all (OP's reply): 9 + 1 + 14 + 10.
   - Gate outcomes: code off, both open (2 opened, 0 shut, the post's log). Code on, 21:52 opens
     after his code, 02:14 stays shut (1 opened, 1 shut), and a code text reaches her phone.
*/
(function () {
  "use strict";

  var TOTAL = 1240;
  var REUSED = 41;
  var REUSED_NOPHONE = 1;
  var EXTRA_FAST = 540;
  var EXTRA_NOPHONE = 14;
  var SHARES = [
    { value: "312", label: "312 of 1,240 (as found)", common: 312, noPhone: 9 },
    { value: "124", label: "124 of 1,240 (what if)", common: 124, noPhone: 4 },
    { value: "62", label: "62 of 1,240 (what if)", common: 62, noPhone: 2 }
  ];
  var STORAGE = [
    { value: "fast", label: "Fast hash, no salt (as found)" },
    { value: "slow", label: "Slow hash, a salt for each password" }
  ];
  var CLOCK = ["14 Oct, 21:00", "14 Oct, 21:52", "15 Oct, 02:14", "15 Oct, 06:00"];
  var LAST = 3;

  /* ---------- small helpers ---------- */

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function pick(list, v) {
    for (var i = 0; i < list.length; i++) if (String(list[i].value) === String(v)) return list[i];
    return list[0];
  }

  /* ---------- the counts (pure functions the display and self-tests read) ---------- */

  function share(C) { return pick(SHARES, C.share); }
  function exposed(C) { return share(C).common + REUSED + (C.storage === "fast" ? EXTRA_FAST : 0); }
  function noPhone(C) { return share(C).noPhone + REUSED_NOPHONE + (C.storage === "fast" ? EXTRA_NOPHONE : 0); }
  function withPhone(C) { return exposed(C) - noPhone(C); }
  function hold(C) { return TOTAL - exposed(C); }

  /* ---------- the night ---------- */

  function newNight() { return { step: 0, opened: 0, shut: 0, at0214: "not yet", alert: "none" }; }

  // Runs the next event; returns its log line and tone.
  function stepNight(S) {
    var C = S.C;
    var N = S.N;
    var line;
    var tone;
    N.step += 1;
    if (N.step === 1) {
      line = "21:52 3 Damson Row, his own new phone, first sign-in, right password.";
      if (C.code) {
        line += " Held for a code; the code went to his number on file, now in his new phone, and he typed it. Barrier opened.";
      } else {
        line += " Barrier opened.";
      }
      N.opened += 1;
      tone = "ok";
    } else if (N.step === 2) {
      line = "02:14 14 Hawthorn Walk, phone 2, never seen before, first sign-in, right password (common, and in another website's leak).";
      if (C.code) {
        line += " Held for a code; the code went by text to Mrs Haverkamp's own phone, abroad, and nobody typed it. Barrier stayed shut.";
        N.shut += 1;
        N.at0214 = "held, stayed shut";
        N.alert = "code text to Mrs Haverkamp, 02:14";
        tone = "ok";
      } else {
        line += " Barrier opened.";
        N.opened += 1;
        N.at0214 = "opened";
        tone = "bad";
      }
      if (C.forced) line += " The 90-day rule changed nothing: she set this password on 22 July, 85 days before.";
      if (C.deleted) line += " Deleting the backup changed nothing: her password was already known.";
    } else {
      line = "06:00 report: 2 first sign-ins from new phones; " + N.opened + " opened, " + N.shut + " kept shut. " +
        "Exposed: " + fmt(exposed(C)) + " of " + fmt(TOTAL) + ", " + fmt(withPhone(C)) + " with a phone on file.";
      tone = N.shut ? "ok" : "warn";
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
    cells.forEach(function (c) { tr.appendChild(ui.el(bold ? "th" : "td", "text-align:left;padding:2px 6px;", String(c))); });
    ui.table.appendChild(tr);
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    var N = S.N;
    var ui = S.ui;
    var sh = share(C);
    var fast = C.storage === "fast";
    ui.head.textContent = "The August copy: 1,240 accounts. Storage: " + pick(STORAGE, C.storage).label.toLowerCase() +
      ". Code for new phones " + (C.code ? "on" : "off") + ". 90-day rule " + (C.forced ? "on" : "off") +
      ". Backup " + (C.deleted ? "deleted from the share" : "still on the share") + ".";
    while (ui.table.firstChild) ui.table.removeChild(ui.table.firstChild);
    row(ui, ["group", "accounts", "exposed?", "no phone on file"], true);
    row(ui, ["common list", fmt(sh.common), "yes", sh.noPhone]);
    row(ui, ["another site's leak", REUSED, "yes", REUSED_NOPHONE]);
    row(ui, ["the adviser's 540", EXTRA_FAST, fast ? "yes" : "no, would hold", EXTRA_NOPHONE]);
    row(ui, ["the rest", fmt(TOTAL - sh.common - REUSED - EXTRA_FAST), "no", 34 - sh.noPhone - REUSED_NOPHONE - EXTRA_NOPHONE]);
    ui.foot.textContent = "Tonight's first sign-ins: 21:52 " + (N.step >= 1 ? "opened" : "not yet") + "; 02:14 " + N.at0214 + "." +
      (C.code ? " A new phone waits for a code sent to the phone on file; an account with no phone on file waits for the guard." : "");
    S.stat.now(CLOCK[N.step]);
    S.stat.accounts(fmt(TOTAL));
    S.stat.common(sh.common);
    S.stat.reused(REUSED);
    S.stat.exposed(fmt(exposed(C)) + " of " + fmt(TOTAL));
    S.stat.phone(fmt(withPhone(C)) + " of " + fmt(exposed(C)));
    S.stat.hold(hold(C));
    S.stat.opened(N.opened);
    S.stat.shut(N.shut);
    S.stat.at0214(N.at0214);
    S.stat.alert(N.alert);
    S.ctl.next.disable(N.step >= LAST);
    S.ctl.all.disable(N.step >= LAST);
  }

  function run(api, steps) {
    var S = api.state;
    var n = 0;
    while (S.N.step < LAST && n < steps) {
      var r = stepNight(S);
      api.log(r.txt, r.tone);
      n += 1;
    }
    draw(api);
  }

  function restart(api, why) {
    var S = api.state;
    var C = S.C;
    S.N = newNight();
    api.log((why ? why + " " : "") + "14 Oct, 21:00, before the night's first gate request. The copy holds 1,240 accounts; stored " +
      (C.storage === "fast" ? "fast with no salt" : "slow and salted") + ", treat " + fmt(exposed(C)) + " as exposed, " +
      fmt(withPhone(C)) + " of them with a phone on file." +
      (C.deleted ? " Backup deleted from the share: copies already taken are not, so no count changes." : "") +
      (C.forced ? " A change is forced every 90 days: no count changes." : ""), "");
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e01", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { storage: "fast", share: "312", code: false, forced: false, deleted: false };
      S.ui = buildWidget(api);
      S.ctl = {};
      function opt(key, conv) { return function (v) { S.C[key] = conv(v); restart(api, "Settings changed."); }; }
      function bool(v) { return !!v; }
      S.ctl.storage = api.control.select("storage", "How the August copy stored passwords", STORAGE, "fast", opt("storage", String));
      S.ctl.share = api.control.select("share", "Residents on a common password", SHARES.map(function (x) { return { value: x.value, label: x.label }; }), "312", opt("share", String));
      S.ctl.code = api.control.toggle("code", "Code to the resident's own phone when a new phone first signs in", false, opt("code", bool));
      S.ctl.forced = api.control.toggle("forced", "Force a new password every 90 days", false, opt("forced", bool));
      S.ctl.deleted = api.control.toggle("deleted", "Delete the backup from the file share", false, opt("deleted", bool));
      S.ctl.next = api.control.button("next", "Next gate request", function () { run(api, 1); });
      S.ctl.all = api.control.button("all", "Run to 06:00", function () { run(api, LAST); });
      S.ctl.again = api.control.button("again", "Start the night again", function () { restart(api, "New night."); });
      S.ctl.reset = api.control.button("reset", "Reset", function () { api.reset(); });
      S.stat = {
        now: api.stat("now", "now", ""),
        accounts: api.stat("accounts", "accounts in the copy", ""),
        common: api.stat("common", "on a common password", "warn"),
        reused: api.stat("reused", "on a password from another site's leak", "warn"),
        exposed: api.stat("exposed", "treat as exposed", "bad"),
        phone: api.stat("phone", "exposed, with a phone on file", ""),
        hold: api.stat("hold", "accounts that hold", "ok"),
        opened: api.stat("opened", "new phones the barrier opened for", "warn"),
        shut: api.stat("shut", "new phones kept shut", "ok"),
        at0214: api.stat("at0214", "02:14, phone 2", "bad"),
        alert: api.stat("alert", "who was told", "")
      };
      api.info("<strong>How to read it.</strong> The table splits the 1,240 accounts in the August copy into the adviser's groups: on a common password, on one from another website's leak, the 540 more that fall only when stored fast with no salt, and the rest. \"Exposed\" means: assume whoever has the copy knows the password. The night has two first sign-ins from new phones, at 21:52 and 02:14. Every number is given data; the lab does no hashing and no guessing.");
      restart(api, "");
    },

    selfTest: async function (t) {
      function S() { return t.api.state; }
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opens at 21:00 on 14 October, before the first gate request, with the copy as found.
      t.expect(t.stat("now") === "14 Oct, 21:00" && t.stat("accounts") === "1,240" && t.stat("common") === 312 &&
        t.stat("reused") === 41 && t.stat("exposed") === "893 of 1,240" && t.stat("phone") === "869 of 893" &&
        t.stat("hold") === 347 && t.stat("opened") === 0 && t.stat("at0214") === "not yet" && S().N.step === 0,
        "Opens at 14 Oct 21:00: 893 of 1,240 exposed, 869 with a phone on file, 347 hold");

      // 2. 21:52: his own new phone, right password, the barrier opens.
      t.click("next");
      t.expect(t.stat("now") === "14 Oct, 21:52" && t.stat("opened") === 1 &&
        has("21:52 3 Damson Row, his own new phone, first sign-in, right password. Barrier opened."),
        "21:52: the man at 3 Damson Row signs in on his new phone and the barrier opens");

      // 3. The record: 02:14 opens for phone 2, and the report.
      t.click("all");
      t.expect(t.stat("now") === "15 Oct, 06:00" && t.stat("opened") === 2 && t.stat("shut") === 0 &&
        t.stat("at0214") === "opened" && t.stat("alert") === "none" &&
        has("02:14 14 Hawthorn Walk, phone 2, never seen before, first sign-in, right password (common, and in another website's leak). Barrier opened.") &&
        has("06:00 report: 2 first sign-ins from new phones; 2 opened, 0 kept shut. Exposed: 893 of 1,240, 869 with a phone on file."),
        "As found: both new phones open the barrier; 02:14 opens on Mrs Haverkamp's password");

      // 4. Option 2: slow and salted shrinks the count to 353, but 02:14 still opens.
      t.set("storage", "slow");
      var slow = t.stat("exposed") === "353 of 1,240" && t.stat("hold") === 887 && t.stat("phone") === "343 of 353";
      t.click("all");
      t.expect(slow && t.stat("at0214") === "opened" && t.stat("opened") === 2,
        "Slow and salted: 353 exposed, 887 hold, 343 with a phone; 02:14 still opens");

      // 5. Never below the common and reused ones, in every scenario.
      var ok5 = true;
      SHARES.forEach(function (sh) {
        t.set("share", sh.value);
        if (t.stat("exposed") !== fmt(sh.common + REUSED) + " of 1,240") ok5 = false;
      });
      t.expect(ok5 && t.stat("exposed") === "103 of 1,240" && t.stat("phone") === "100 of 103",
        "Slow and salted never goes below common + 41 reused: 353, 165, 103");

      // 6. The same what-ifs stored fast: 705 and 643.
      t.set("storage", "fast");
      var f62 = t.stat("exposed") === "643 of 1,240" && t.stat("phone") === "626 of 643";
      t.set("share", "124");
      t.expect(f62 && t.stat("exposed") === "705 of 1,240" && t.stat("phone") === "686 of 705" && t.stat("common") === 124,
        "Fast with no salt: 124 common gives 705 exposed (686 with a phone), 62 gives 643 (626)");

      // 7. Option 1: the code. 21:52 opens after his code; 02:14 stays shut; she is told.
      t.set("share", "312");
      t.set("code", true);
      t.click("all");
      t.expect(t.stat("opened") === 1 && t.stat("shut") === 1 && t.stat("at0214") === "held, stayed shut" &&
        t.stat("alert") === "code text to Mrs Haverkamp, 02:14" && t.stat("exposed") === "893 of 1,240" &&
        has("Held for a code; the code went to his number on file, now in his new phone, and he typed it. Barrier opened.") &&
        has("Held for a code; the code went by text to Mrs Haverkamp's own phone, abroad, and nobody typed it. Barrier stayed shut."),
        "Code on: 21:52 opens after his code, 02:14 held and shut, the code text reaches Mrs Haverkamp; 893 still exposed");

      // 8. Option 0: a forced change every 90 days changes nothing tonight.
      t.set("code", false);
      t.set("forced", true);
      t.click("all");
      t.expect(t.stat("at0214") === "opened" && t.stat("exposed") === "893 of 1,240" &&
        has("The 90-day rule changed nothing: she set this password on 22 July, 85 days before."),
        "90-day rule: her password was 85 days old, 02:14 opens, 893 still exposed");

      // 9. Option 3: deleting the backup changes nothing tonight.
      t.set("forced", false);
      t.set("deleted", true);
      t.click("all");
      t.expect(t.stat("at0214") === "opened" && t.stat("exposed") === "893 of 1,240" && t.stat("opened") === 2 &&
        has("Backup deleted from the share: copies already taken are not, so no count changes."),
        "Backup deleted: copies already taken, 893 exposed, 02:14 opens");

      // 10. Everything together: slow, salted, fewest common, and the code: 02:14 still shut.
      t.set("deleted", false);
      t.set("storage", "slow");
      t.set("share", "62");
      t.set("code", true);
      t.click("all");
      t.expect(t.stat("exposed") === "103 of 1,240" && t.stat("at0214") === "held, stayed shut" && t.stat("shut") === 1 &&
        t.stat("now") === "15 Oct, 06:00",
        "Slow, salted, 62 common, code on: 103 exposed and 02:14 kept shut");
    }
  });
})();
