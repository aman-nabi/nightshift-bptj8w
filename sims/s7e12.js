/* sims/s7e12-v1.0.0.js  (published as sims/s7e12.js)
   Case s7e12 "The Letter You Didn't Send": a phishing-spotting trainer and a payment check for the
   Wickstead Trust, a small charity. In September 2026 a reply under the director's name, sent from a
   lookalike of the charity's domain (one letter changed), asked that invoice 1187 from Harcastle
   Heating, 8,640 pounds, be paid to a new account, and the bookkeeper paid it. The learner reads 12
   short training samples, each a label and a neutral description, sees which checks each passes and
   its sender's domain beside the charity's own, letter by letter, and marks each one. Then the learner
   turns on the defences (SPF, DKIM and DMARC for the charity's domain, an outside-sender banner, a
   call back on the number on file, two people for every payment) and replays September's payment.
   Widget-style sim: it draws inside api.root.
   It models the defence and its numbers only. It sends nothing, holds no email text, and never shows a
   lookalike domain in full: the sender's line shows the charity's own domain with the changed letter
   replaced by "?". Every domain here ends in the reserved .example, which no one can register.

   CHANGELOG
   v1.0.0 (2026-10-15) first version: 12 labelled training samples (sample select, mark it looks fine,
     mark it check first); controls SPF, DKIM and DMARC for the charity's domain (on, off), outside
     banner (on, off), call back on the number on file (on, off), two people for every payment (on,
     off); Play September. Stats: marked right, marked wrong, unmarked, samples passing all three
     checks, samples bounced, samples carrying the banner, payments in September, paid to accounts on
     file, paid to an account not on file, money sent to the new account, the payment's outcome.
     selfTest: 11 assertions.

   Where every number comes from (conventions rule 14; the case is content/s7/s7e12-v1.0.0.json).
   All of it is given data stated in sim.lede, and each count is checked by the selfTest.
   - September 2026: 46 payments. As built 45 go to accounts in the supplier file and 1, invoice 1187,
     8,640 pounds to Harcastle Heating, goes to a new account on Thursday 24 September at 14:05.
   - The thread: Monday 14 September 09:12 (invoice, for approval, Harcastle's accounts address copied
     in); Tuesday 15 September 08:47 (approved, from the charity's own domain); the lookalike domain
     first registered Thursday 17 September; the forged reply Tuesday 22 September 10:31; paid
     Thursday 24 September 14:05; found on Thursday 1 October at 23:40.
   - Harcastle's bank details and office number in the supplier file since Monday 4 March 2019.
   - The finance mailbox received 312 emails in September, 287 of them from outside the charity's
     domain: the banner sits on 287 of 312.
   - The charity's domain: wicksteadtrust.example, 22 characters. The lookalike differs at letter 6.
   - 12 samples, 6 of them worth checking first (5, 6, 7, 8, 10, 12) and 6 fine (1, 2, 3, 4, 9, 11).
     Checks off: 9 pass all three (every sample but 3, 8 and 11, which use or claim the charity's
     domain, which publishes nothing), 0 bounced. Checks on: 11 pass all three, sample 8 fails all
     three and bounces. Of the 6 worth checking, 5 pass all three either way (5, 6, 7, 10, 12).
     The banner goes by the address after the @, so it marks the 9 samples from other domains, and
     not sample 8, which claims the charity's own.
   - With a call back or two people: 46 to accounts on file, 0 to a new account, 0 pounds lost.
   Not modelled: the phishing test of option 3 (the request held no link, so it changes no number),
   the bank's recall (stated in the story: nothing came back).
*/
(function () {
  "use strict";

  /* ---------- the story's numbers ---------- */

  var PAYMENTS = 46;
  var AMOUNT = "£8,640";
  var SEPT_MAIL = 312;
  var SEPT_OUTSIDE = 287;
  var OURS = "wicksteadtrust.example";
  var CHANGED_AT = 6; // letter 6 of 22 differs in the lookalike

  // kind: "own" (our domain, really ours), "ext" (another organisation's own domain),
  // "forged" (claims our exact domain, sent from servers ours does not list),
  // "lookalike" (a lookalike of our domain), "otherlook" (a lookalike of someone else's domain).
  var SAMPLES = [
    { n: 1, text: "a monthly statement from our bank, from the bank's usual address", kind: "ext", check: false, link: false },
    { n: 2, text: "an invoice from a supplier you use, from the usual address", kind: "ext", check: false, link: false },
    { n: 3, text: "a note from a colleague about the rota, from our own address", kind: "own", check: false, link: false },
    { n: 4, text: "a donor asking for a receipt, from a free webmail address", kind: "ext", check: false, link: false },
    { n: 5, text: "a supplier you use says its bank details have changed, from its usual address", kind: "ext", check: true, link: false },
    { n: 6, text: "a request under the director's name to pay a new account, from a lookalike of our address", kind: "lookalike", check: true, link: false },
    { n: 7, text: "a parcel-waiting notice with a link, from an address you have never seen", kind: "ext", check: true, link: true },
    { n: 8, text: "a request under our own address, sent from servers our domain does not list", kind: "forged", check: true, link: false },
    { n: 9, text: "a newsletter from a charity network, from its usual address", kind: "ext", check: false, link: true },
    { n: 10, text: "a password-expiry warning with a link, from a lookalike of our email provider's address", kind: "otherlook", check: true, link: true },
    { n: 11, text: "the director confirming a meeting, from our own address", kind: "own", check: false, link: false },
    { n: 12, text: "an invoice with a supplier's name as the display name, from a free webmail address", kind: "ext", check: true, link: false }
  ];

  /* ---------- the model (pure functions the display and self-tests read) ---------- */

  function checks(C, s) {
    if (s.kind === "own") return C.auth ? ["pass", "pass", "pass"] : ["none", "none", "none"];
    if (s.kind === "forged") return C.auth ? ["fail", "fail", "fail"] : ["none", "none", "none"];
    return ["pass", "pass", "pass"];
  }
  function passAll(C, s) { return checks(C, s).join() === "pass,pass,pass"; }
  function bounced(C, s) { return s.kind === "forged" && C.auth; }
  function bannered(C, s) { return C.banner && !bounced(C, s) && s.kind !== "own" && s.kind !== "forged"; }
  function domainLine(s) {
    if (s.kind === "own") return "the same as ours";
    if (s.kind === "forged") return "exactly ours, but not sent from our servers";
    if (s.kind === "lookalike") return "a lookalike of ours: letter " + CHANGED_AT + " of " + OURS.length + " differs";
    if (s.kind === "otherlook") return "a lookalike of our email provider's domain, one letter changed";
    return "another organisation's own domain";
  }
  function letters(s) {
    var a = OURS.split("").join(" ");
    if (s.kind !== "lookalike") return ["ours:   " + a];
    var b = OURS.split("").map(function (ch, i) { return i === CHANGED_AT - 1 ? "?" : ch; }).join(" ");
    var m = OURS.split("").map(function (ch, i) { return i === CHANGED_AT - 1 ? "^" : " "; }).join(" ");
    return ["ours:   " + a, "sender: " + b, "        " + m];
  }
  function sampleTotals(C, marks) {
    var t = { pass: 0, bounced: 0, banner: 0, right: 0, wrong: 0, unmarked: 0, checkPass: 0 };
    SAMPLES.forEach(function (s) {
      if (passAll(C, s)) t.pass += 1;
      if (passAll(C, s) && s.check) t.checkPass += 1;
      if (bounced(C, s)) t.bounced += 1;
      if (bannered(C, s)) t.banner += 1;
      var m = marks[s.n];
      if (!m) t.unmarked += 1;
      else if ((m === "check") === s.check) t.right += 1;
      else t.wrong += 1;
    });
    return t;
  }
  function payment(C) {
    if (C.callback) return { onFile: PAYMENTS, changed: 0, lost: "£0", outcome: "stopped by the call back" };
    if (C.two) return { onFile: PAYMENTS, changed: 0, lost: "£0", outcome: "held by the second person" };
    return { onFile: PAYMENTS - 1, changed: 1, lost: AMOUNT, outcome: "paid to the new account" };
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
    var wrap = el("div", "overflow-x:auto;");
    var table = el("table", "width:100%;font-size:12px;");
    var hr = el("tr");
    ["no.", "training sample", "sender's domain", "SPF", "DKIM", "DMARC", "banner", "your mark"].forEach(function (h) {
      hr.appendChild(el("th", "text-align:left;", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
    var compare = el("pre", "margin:0;font-size:12px;white-space:pre-wrap;");
    box.appendChild(compare);
    api.root.appendChild(box);
    return { el: el, head: head, tbody: tbody, compare: compare };
  }

  function drawTable(S) {
    var ui = S.ui;
    var C = S.C;
    clear(ui.tbody);
    SAMPLES.forEach(function (s) {
      var tr = ui.el("tr", s.n === S.sel ? "font-weight:bold;" : "");
      var c = checks(C, s);
      var m = S.marks[s.n];
      var cells = [
        String(s.n) + (s.n === S.sel ? " >" : ""),
        "training sample: " + s.text + (s.link ? " (has a link)" : " (no link)"),
        domainLine(s),
        c[0], c[1], c[2] + (bounced(C, s) ? ", bounced" : ""),
        bannered(C, s) ? "outside" : "-",
        m ? (m === "check" ? "check first" : "looks fine") : "not marked"
      ];
      cells.forEach(function (x) { tr.appendChild(ui.el("td", "", x)); });
      ui.tbody.appendChild(tr);
    });
  }

  function drawCompare(S) {
    var s = SAMPLES[S.sel - 1];
    var c = checks(S.C, s);
    var lines = ["Sample " + s.n + ", letter by letter against our domain:"].concat(letters(s));
    lines.push("Checks for the domain after the @: SPF " + c[0] + ", DKIM " + c[1] + ", DMARC " + c[2] + ".");
    S.ui.compare.textContent = lines.join("\n");
  }

  function draw(api) {
    var S = api.state;
    var C = S.C;
    S.ui.head.textContent = "SPF, DKIM and DMARC for our domain: " + (C.auth ? "on, policy reject" : "off, nothing published") +
      ". Outside banner: " + (C.banner ? "on" : "off") + ". Call back on the number on file: " + (C.callback ? "on" : "off") +
      ". Two people for every payment: " + (C.two ? "on" : "off") + ".";
    drawTable(S);
    drawCompare(S);
    var T = sampleTotals(C, S.marks);
    S.stat.right(String(T.right));
    S.stat.wrong(String(T.wrong));
    S.stat.unmarked(String(T.unmarked));
    S.stat.pass(String(T.pass));
    S.stat.bounced(String(T.bounced));
    S.stat.banner(String(T.banner));
    if (!S.ran) {
      ["payments", "onfile", "changed", "lost", "outcome"].forEach(function (k) { S.stat[k]("not run yet"); });
      return;
    }
    var P = payment(C);
    S.stat.payments(String(PAYMENTS));
    S.stat.onfile(String(P.onFile));
    S.stat.changed(String(P.changed));
    S.stat.lost(P.lost);
    S.stat.outcome(P.outcome);
  }

  // A change to a defence sets September back to before the thread began.
  function change(api, what) {
    api.state.ran = false;
    api.log(what + " September is set back to before Monday 14 September.", "");
    draw(api);
  }

  function mark(api, m) {
    var S = api.state;
    var s = SAMPLES[S.sel - 1];
    S.marks[s.n] = m;
    var right = (m === "check") === s.check;
    api.log("Sample " + s.n + " marked " + (m === "check" ? "check first" : "looks fine") + ": " +
      (right ? "right." : "not this one.") + (s.check ? " It is worth checking by another route before acting." : " It is ordinary mail."),
      right ? "ok" : "warn");
    draw(api);
  }

  function run(api) {
    var S = api.state;
    var C = S.C;
    if (S.ran) {
      api.log("September has already played. Change a defence or reset to play it again.", "");
      return;
    }
    api.log("Monday 14 September 09:12: Mr Tuckwell asks Ms Kilbride to approve invoice 1187, " + AMOUNT + ", for Harcastle Heating. Harcastle's accounts address is copied in.", "");
    api.log("Tuesday 15 September 08:47: Ms Kilbride approves, from our own domain.", "ok");
    api.log("Thursday 17 September: the lookalike domain is first registered.", "warn");
    api.log("Tuesday 22 September 10:31: a reply under Ms Kilbride's name, from the lookalike domain, asks that invoice 1187 be paid to a new account. SPF pass, DKIM pass, DMARC pass, each for the lookalike's own domain." +
      (C.auth ? " Our own domain's checks don't apply: the domain after the @ isn't ours." : ""), "bad");
    if (C.banner) api.log("The reply carries the outside banner, as do " + SEPT_OUTSIDE + " of September's " + SEPT_MAIL + " emails. A banner warns; it stops nothing.", "warn");
    if (C.callback) {
      api.log("Thursday 24 September: before paying, Mr Tuckwell rings Harcastle on the number in the supplier file, there since Monday 4 March 2019, not any number in the email. Harcastle's bank hasn't changed. " + AMOUNT + " goes to the account on file.", "ok");
    } else if (C.two) {
      api.log("Thursday 24 September: Mr Tuckwell sets up the payment. The second person compares its account with the supplier file, finds it isn't Harcastle's, and won't approve. The payment is held until Harcastle confirms on the number on file; " + AMOUNT + " goes to the account on file.", "ok");
    } else {
      api.log("Thursday 24 September 14:05: Mr Tuckwell pays " + AMOUNT + " to the new account, alone. The bank emails its usual payment confirmation to the finance mailbox.", "bad");
    }
    var P = payment(C);
    api.log("Wednesday 30 September: September closes with " + PAYMENTS + " payments, " + P.onFile + " to accounts in the supplier file and " + P.changed + " to an account not in it.", P.changed ? "bad" : "ok");
    S.ran = true;
    draw(api);
  }

  /* ---------- the module ---------- */

  DL.sims.define("s7e12", {
    setup: function (api) {
      var S = api.state;
      api.speed = 0;
      S.C = { auth: false, banner: false, callback: false, two: false };
      S.ran = false;
      S.sel = 1;
      S.marks = {};
      S.ui = buildWidget(api);

      var opts = SAMPLES.map(function (s) { return { value: String(s.n), label: "sample " + s.n }; });
      api.control.select("sample", "Training sample to read", opts, "1", function (v) {
        var n = Number(v);
        if (!(n >= 1 && n <= SAMPLES.length)) return;
        S.sel = n;
        var s = SAMPLES[n - 1];
        var c = checks(S.C, s);
        api.log("Sample " + n + ": " + s.text + ". Sender's domain: " + domainLine(s) + ". SPF " + c[0] + ", DKIM " + c[1] + ", DMARC " + c[2] +
          (s.kind === "lookalike" || s.kind === "otherlook" || s.kind === "ext" ? ", for its own domain." : ".") + (bounced(S.C, s) ? " It bounces." : ""), "");
        draw(api);
      });
      api.control.button("fine", "Mark it: looks fine", function () { mark(api, "fine"); });
      api.control.button("suspicious", "Mark it: check first", function () { mark(api, "check"); });
      api.control.toggle("auth", "SPF, DKIM and DMARC for our domain, policy reject", false, function (on) {
        S.C.auth = !!on;
        change(api, "SPF, DKIM and DMARC for our domain: " + (on ? "on." : "off."));
      });
      api.control.toggle("banner", "Banner on every email from outside our domain", false, function (on) {
        S.C.banner = !!on;
        change(api, "Outside banner: " + (on ? "on." : "off."));
      });
      api.control.toggle("callback", "Call back on the number on file before any change of bank details", false, function (on) {
        S.C.callback = !!on;
        change(api, "Call back on the number on file: " + (on ? "on." : "off."));
      });
      api.control.toggle("two", "Two people for every payment", false, function (on) {
        S.C.two = !!on;
        change(api, "Two people for every payment: " + (on ? "on." : "off."));
      });
      api.control.button("run", "Play September", function () { run(api); });
      api.control.button("reset", "Reset", function () { api.reset(); });

      S.stat = {
        right: api.stat("right", "samples marked right", "ok"),
        wrong: api.stat("wrong", "samples marked wrong", "warn"),
        unmarked: api.stat("unmarked", "samples not marked", ""),
        pass: api.stat("pass", "samples passing all three checks", ""),
        bounced: api.stat("bounced", "samples bounced", ""),
        banner: api.stat("banner", "samples with the outside banner", "warn"),
        payments: api.stat("payments", "payments in September", ""),
        onfile: api.stat("onfile", "paid to accounts on file", ""),
        changed: api.stat("changed", "paid to an account not on file", "bad"),
        lost: api.stat("lost", "sent to the new account", "bad"),
        outcome: api.stat("outcome", "invoice 1187", "bad")
      };

      api.info("<strong>How to read it.</strong> Each row is a short training sample, described in general words, never real email text. The three checks are for the domain after the @, whichever domain that is. Pick a sample to see its sender's domain beside ours, letter by letter, and mark it. Then set the defences and play September's payment of invoice 1187.");

      api.log("Before Monday 14 September 2026, as built: our domain publishes no SPF, DKIM or DMARC, no banner, no call back, and Mr Tuckwell pays alone. 12 training samples, none marked.", "");
      draw(api);
    },

    selfTest: async function (t) {
      function has(s) { return t.logText().indexOf(s) >= 0; }

      // 1. Opening state: before the thread, nothing marked, payment not played.
      t.expect(t.stat("right") === 0 && t.stat("unmarked") === 12 && t.stat("pass") === 9 && t.stat("bounced") === 0 &&
        t.stat("banner") === 0 && t.stat("outcome") === "not run yet" && t.stat("lost") === "not run yet",
        "Opens before 14 September: 12 samples unmarked, 9 pass all three checks, payment not played");

      // 2. The lookalike passes all three checks for its own domain, one letter off ours.
      t.set("sample", "6");
      t.expect(has("Sample 6: a request under the director's name to pay a new account, from a lookalike of our address. Sender's domain: a lookalike of ours: letter 6 of 22 differs. SPF pass, DKIM pass, DMARC pass, for its own domain."),
        "Sample 6, the lookalike: letter 6 of 22 differs, and SPF, DKIM and DMARC all pass for its own domain");

      // 3. Marking: right and wrong.
      t.click("suspicious");
      t.set("sample", "1");
      t.click("suspicious");
      t.expect(t.stat("right") === 1 && t.stat("wrong") === 1 && t.stat("unmarked") === 10,
        "Marking sample 6 check first is right; sample 1 check first is wrong; 10 left");

      // 4. As built: the payment goes to the new account.
      t.click("run");
      t.expect(t.stat("payments") === 46 && t.stat("onfile") === 45 && t.stat("changed") === 1 && t.stat("lost") === "£8,640" &&
        t.stat("outcome") === "paid to the new account" && has("Thursday 24 September 14:05: Mr Tuckwell pays £8,640 to the new account, alone."),
        "As built: 46 payments, 45 to accounts on file, £8,640 to the new account");

      // 5. Option 0: our checks on bounce the exact forgery, not the lookalike.
      t.set("auth", true);
      t.expect(t.stat("pass") === 11 && t.stat("bounced") === 1 && t.stat("outcome") === "not run yet",
        "Checks on: 11 pass all three, sample 8 bounces, September set back");
      t.click("run");
      t.expect(t.stat("lost") === "£8,640" && t.stat("changed") === 1 && has("Our own domain's checks don't apply: the domain after the @ isn't ours."),
        "Checks on: the lookalike still passes for itself and £8,640 still goes to the new account");

      // 6. Option 1: the banner marks most mail and stops nothing.
      t.set("auth", false);
      t.set("banner", true);
      t.click("run");
      t.expect(t.stat("banner") === 9 && t.stat("lost") === "£8,640" && has("as do 287 of September's 312 emails"),
        "Banner on: 9 of 12 samples and 287 of 312 emails carry it; £8,640 still goes");

      // 7. Option 2: the call back on the number on file stops it.
      t.set("banner", false);
      t.set("callback", true);
      t.click("run");
      t.expect(t.stat("onfile") === 46 && t.stat("changed") === 0 && t.stat("lost") === "£0" && t.stat("outcome") === "stopped by the call back" &&
        has("there since Monday 4 March 2019"),
        "Call back on: 46 to accounts on file, £0 to the new account");

      // 8. Two people for every payment also stops it.
      t.set("callback", false);
      t.set("two", true);
      t.click("run");
      t.expect(t.stat("outcome") === "held by the second person" && t.stat("lost") === "£0" && t.stat("changed") === 0,
        "Two people on: the second person holds the payment; £0 to the new account");

      // 9. A second play is refused until something changes.
      t.click("run");
      t.expect(has("September has already played.") && t.stat("lost") === "£0", "A second play is refused");

      // 10. Of the 6 samples worth checking, 5 pass all three checks either way.
      var S = t.api.state;
      t.expect(sampleTotals(S.C, {}).checkPass === 5 && sampleTotals({ auth: true, banner: false }, {}).checkPass === 5,
        "5 of the 6 samples worth checking pass all three checks, with our checks on or off");
    }
  });
})();
